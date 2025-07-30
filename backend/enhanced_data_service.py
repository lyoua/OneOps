"""增强的数据服务层 - 提供更好的事务管理和错误处理"""

from typing import List, Dict, Any, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from contextlib import contextmanager
import uuid
import json
from datetime import datetime

from models import (
    SessionLocal, Dashboard, Variable, SavedQuery, 
    DashboardTemplate, VariableValue
)

class EnhancedDataService:
    """增强的数据服务类"""
    
    def __init__(self):
        self.session_factory = SessionLocal
    
    @contextmanager
    def get_session(self):
        """获取数据库会话的上下文管理器"""
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def _generate_id(self, prefix: str = '') -> str:
        """生成唯一ID"""
        return f"{prefix}{uuid.uuid4().hex[:12]}"
    
    # ==================== 仪表板管理 ====================
    
    def get_dashboards(self) -> List[Dict[str, Any]]:
        """获取所有仪表板"""
        with self.get_session() as session:
            dashboards = session.query(Dashboard).order_by(
                Dashboard.updated_at.desc()
            ).all()
            return [self._dashboard_to_dict(d) for d in dashboards]
    
    def get_dashboard_by_id(self, dashboard_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取仪表板"""
        with self.get_session() as session:
            dashboard = session.query(Dashboard).filter(
                Dashboard.id == dashboard_id
            ).first()
            return self._dashboard_to_dict(dashboard) if dashboard else None
    
    def get_dashboard_by_title(self, title: str) -> Optional[Dict[str, Any]]:
        """根据标题获取仪表板"""
        with self.get_session() as session:
            dashboard = session.query(Dashboard).filter(
                Dashboard.title == title
            ).first()
            return self._dashboard_to_dict(dashboard) if dashboard else None
    
    def create_dashboard(self, dashboard_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建仪表板"""
        with self.get_session() as session:
            # 检查标题是否已存在
            existing = session.query(Dashboard).filter(
                Dashboard.title == dashboard_data.get('title')
            ).first()
            
            if existing:
                raise ValueError(f"仪表板标题 '{dashboard_data.get('title')}' 已存在")
            
            dashboard_id = dashboard_data.get('id') or self._generate_id('dash_')
            
            dashboard = Dashboard(
                id=dashboard_id,
                title=dashboard_data.get('title', ''),
                description=dashboard_data.get('description', ''),
                category=dashboard_data.get('category', 'default'),
                time_range=dashboard_data.get('timeRange', '1h'),
                refresh_interval=dashboard_data.get('refreshInterval', 30),
                variables=dashboard_data.get('variables', []),
                panels=dashboard_data.get('panels', []),
                tags=dashboard_data.get('tags', []),
                is_template=dashboard_data.get('isTemplate', False),
                is_public=dashboard_data.get('isPublic', True),
                version=1
            )
            
            session.add(dashboard)
            session.flush()  # 确保获取ID
            
            return self._dashboard_to_dict(dashboard)
    
    def update_dashboard(self, dashboard_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """更新仪表板"""
        with self.get_session() as session:
            dashboard = session.query(Dashboard).filter(
                Dashboard.id == dashboard_id
            ).first()
            
            if not dashboard:
                raise ValueError(f"仪表板 {dashboard_id} 不存在")
            
            # 检查标题冲突（如果更新标题）
            if 'title' in updates and updates['title'] != dashboard.title:
                existing = session.query(Dashboard).filter(
                    Dashboard.title == updates['title'],
                    Dashboard.id != dashboard_id
                ).first()
                
                if existing:
                    raise ValueError(f"仪表板标题 '{updates['title']}' 已存在")
            
            # 更新字段
            for key, value in updates.items():
                if key == 'timeRange':
                    dashboard.time_range = value
                elif key == 'refreshInterval':
                    dashboard.refresh_interval = value
                elif hasattr(dashboard, key):
                    setattr(dashboard, key, value)
            
            dashboard.updated_at = datetime.utcnow()
            dashboard.version += 1
            
            return self._dashboard_to_dict(dashboard)
    
    def delete_dashboard(self, dashboard_id: str) -> bool:
        """删除仪表板"""
        with self.get_session() as session:
            dashboard = session.query(Dashboard).filter(
                Dashboard.id == dashboard_id
            ).first()
            
            if not dashboard:
                raise ValueError(f"仪表板 {dashboard_id} 不存在")
            
            # 删除相关的变量值记录
            session.query(VariableValue).filter(
                VariableValue.dashboard_id == dashboard_id
            ).delete()
            
            # 删除相关的变量
            session.query(Variable).filter(
                Variable.dashboard_id == dashboard_id
            ).delete()
            
            # 删除仪表板
            session.delete(dashboard)
            
            return True
    
    def _dashboard_to_dict(self, dashboard: Dashboard) -> Dict[str, Any]:
        """将仪表板模型转换为字典"""
        if not dashboard:
            return {}
        
        return {
            'id': dashboard.id,
            'title': dashboard.title,
            'description': dashboard.description or '',
            'category': dashboard.category or 'default',
            'timeRange': dashboard.time_range,
            'refreshInterval': dashboard.refresh_interval,
            'variables': dashboard.variables or [],
            'panels': dashboard.panels or [],
            'tags': dashboard.tags or [],
            'isTemplate': dashboard.is_template,
            'isPublic': dashboard.is_public,
            'version': dashboard.version,
            'createdAt': dashboard.created_at.isoformat() if dashboard.created_at else None,
            'updatedAt': dashboard.updated_at.isoformat() if dashboard.updated_at else None
        }
    
    # ==================== 变量管理 ====================
    
    def get_variables(self, dashboard_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取变量列表"""
        with self.get_session() as session:
            query = session.query(Variable)
            
            if dashboard_id:
                query = query.filter(Variable.dashboard_id == dashboard_id)
            else:
                query = query.filter(Variable.dashboard_id.is_(None))
            
            variables = query.order_by(Variable.name).all()
            return [self._variable_to_dict(v) for v in variables]
    
    def get_variable_by_id(self, variable_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取变量"""
        with self.get_session() as session:
            variable = session.query(Variable).filter(
                Variable.id == variable_id
            ).first()
            return self._variable_to_dict(variable) if variable else None
    
    def get_variable_by_name(self, name: str, dashboard_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """根据名称获取变量"""
        with self.get_session() as session:
            query = session.query(Variable).filter(Variable.name == name)
            
            if dashboard_id:
                query = query.filter(Variable.dashboard_id == dashboard_id)
            else:
                query = query.filter(Variable.dashboard_id.is_(None))
            
            variable = query.first()
            return self._variable_to_dict(variable) if variable else None
    
    def create_variable(self, variable_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建变量"""
        with self.get_session() as session:
            dashboard_id = variable_data.get('dashboard_id')
            name = variable_data.get('name')
            
            # 检查变量名是否已存在
            existing = session.query(Variable).filter(
                Variable.name == name,
                Variable.dashboard_id == dashboard_id
            ).first()
            
            if existing:
                scope = f"仪表板 {dashboard_id}" if dashboard_id else "全局"
                raise ValueError(f"变量名 '{name}' 在{scope}中已存在")
            
            variable_id = variable_data.get('id') or self._generate_id('var_')
            
            variable = Variable(
                id=variable_id,
                name=name,
                label=variable_data.get('label', name),
                type=variable_data.get('type', 'query'),
                query=variable_data.get('query', ''),
                options=variable_data.get('options', []),
                value=variable_data.get('value', ''),
                multi=variable_data.get('multi', False),
                description=variable_data.get('description', ''),
                refresh=variable_data.get('refresh', 'on_dashboard_load'),
                sort=variable_data.get('sort', 'disabled'),
                include_all=variable_data.get('include_all', False),
                all_value=variable_data.get('all_value', ''),
                regex=variable_data.get('regex', ''),
                hide=variable_data.get('hide', 'none'),
                dashboard_id=dashboard_id,
                template_id=variable_data.get('template_id'),
                is_global=variable_data.get('is_global', dashboard_id is None),
                version=1
            )
            
            session.add(variable)
            session.flush()
            
            return self._variable_to_dict(variable)
    
    def update_variable(self, variable_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """更新变量"""
        with self.get_session() as session:
            variable = session.query(Variable).filter(
                Variable.id == variable_id
            ).first()
            
            if not variable:
                raise ValueError(f"变量 {variable_id} 不存在")
            
            # 检查名称冲突（如果更新名称）
            if 'name' in updates and updates['name'] != variable.name:
                existing = session.query(Variable).filter(
                    Variable.name == updates['name'],
                    Variable.dashboard_id == variable.dashboard_id,
                    Variable.id != variable_id
                ).first()
                
                if existing:
                    scope = f"仪表板 {variable.dashboard_id}" if variable.dashboard_id else "全局"
                    raise ValueError(f"变量名 '{updates['name']}' 在{scope}中已存在")
            
            # 更新字段
            for key, value in updates.items():
                if hasattr(variable, key):
                    setattr(variable, key, value)
            
            # 确保label字段不为空
            if not variable.label and variable.name:
                variable.label = variable.name
            
            variable.updated_at = datetime.utcnow()
            variable.version += 1
            
            return self._variable_to_dict(variable)
    
    def delete_variable(self, variable_id: str) -> bool:
        """删除变量"""
        with self.get_session() as session:
            variable = session.query(Variable).filter(
                Variable.id == variable_id
            ).first()
            
            if not variable:
                raise ValueError(f"变量 {variable_id} 不存在")
            
            # 删除相关的变量值记录
            session.query(VariableValue).filter(
                VariableValue.variable_id == variable_id
            ).delete()
            
            # 删除变量
            session.delete(variable)
            
            return True
    
    def _variable_to_dict(self, variable: Variable) -> Dict[str, Any]:
        """将变量模型转换为字典"""
        if not variable:
            return {}
        
        return {
            'id': variable.id,
            'name': variable.name,
            'label': variable.label or variable.name,
            'type': variable.type,
            'query': variable.query or '',
            'options': variable.options or [],
            'value': variable.value or '',
            'multi': variable.multi,
            'description': variable.description or '',
            'refresh': variable.refresh,
            'sort': variable.sort,
            'include_all': variable.include_all,
            'all_value': variable.all_value or '',
            'regex': variable.regex or '',
            'hide': variable.hide,
            'dashboard_id': variable.dashboard_id,
            'template_id': variable.template_id,
            'is_global': variable.is_global,
            'version': variable.version,
            'created_at': variable.created_at.isoformat() if variable.created_at else None,
            'updated_at': variable.updated_at.isoformat() if variable.updated_at else None
        }
    
    # ==================== 变量值管理 ====================
    
    def save_variable_value(self, variable_name: str, value: Union[str, List[str]], 
                          dashboard_id: Optional[str] = None, 
                          session_id: Optional[str] = None) -> Dict[str, Any]:
        """保存变量值"""
        with self.get_session() as session:
            # 查找变量
            query = session.query(Variable).filter(Variable.name == variable_name)
            
            if dashboard_id:
                query = query.filter(Variable.dashboard_id == dashboard_id)
            else:
                query = query.filter(Variable.dashboard_id.is_(None))
            
            variable = query.first()
            
            if not variable:
                scope = f"仪表板 {dashboard_id}" if dashboard_id else "全局"
                raise ValueError(f"变量 '{variable_name}' 在{scope}中不存在")
            
            # 创建变量值记录
            variable_value = VariableValue(
                variable_id=variable.id,
                variable_name=variable_name,
                value=value,
                dashboard_id=dashboard_id,
                session_id=session_id or self._generate_id('session_')
            )
            
            session.add(variable_value)
            session.flush()
            
            return {
                'id': variable_value.id,
                'variable_id': variable_value.variable_id,
                'variable_name': variable_value.variable_name,
                'value': variable_value.value,
                'dashboard_id': variable_value.dashboard_id,
                'session_id': variable_value.session_id,
                'created_at': variable_value.created_at.isoformat()
            }
    
    def get_variable_values(self, dashboard_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取变量值"""
        with self.get_session() as session:
            query = session.query(VariableValue)
            
            if dashboard_id:
                query = query.filter(VariableValue.dashboard_id == dashboard_id)
            
            variable_values = query.order_by(
                VariableValue.created_at.desc()
            ).all()
            
            return [{
                'id': vv.id,
                'variable_id': vv.variable_id,
                'variable_name': vv.variable_name,
                'value': vv.value,
                'dashboard_id': vv.dashboard_id,
                'session_id': vv.session_id,
                'created_at': vv.created_at.isoformat()
            } for vv in variable_values]
    
    # ==================== 模板管理 ====================
    
    def get_templates(self) -> List[Dict[str, Any]]:
        """获取所有模板"""
        with self.get_session() as session:
            templates = session.query(DashboardTemplate).filter(
                DashboardTemplate.is_active == True
            ).order_by(DashboardTemplate.name).all()
            
            return [self._template_to_dict(t) for t in templates]
    
    def get_template_by_id(self, template_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取模板"""
        with self.get_session() as session:
            template = session.query(DashboardTemplate).filter(
                DashboardTemplate.id == template_id
            ).first()
            return self._template_to_dict(template) if template else None
    
    def create_template(self, template_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建模板"""
        with self.get_session() as session:
            # 检查模板名是否已存在
            existing = session.query(DashboardTemplate).filter(
                DashboardTemplate.name == template_data.get('name')
            ).first()
            
            if existing:
                raise ValueError(f"模板名 '{template_data.get('name')}' 已存在")
            
            template_id = template_data.get('id') or self._generate_id('tpl_')
            
            template = DashboardTemplate(
                id=template_id,
                name=template_data.get('name', ''),
                description=template_data.get('description', ''),
                category=template_data.get('category', 'default'),
                panels=template_data.get('panels', []),
                variables=template_data.get('variables', []),
                tags=template_data.get('tags', []),
                is_builtin=template_data.get('is_builtin', False),
                version=template_data.get('version', '1.0.0'),
                is_active=True
            )
            
            session.add(template)
            session.flush()
            
            return self._template_to_dict(template)
    
    def update_template(self, template_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """更新模板"""
        with self.get_session() as session:
            template = session.query(DashboardTemplate).filter(
                DashboardTemplate.id == template_id
            ).first()
            
            if not template:
                raise ValueError(f"模板 {template_id} 不存在")
            
            # 检查名称冲突（如果更新名称）
            if 'name' in updates and updates['name'] != template.name:
                existing = session.query(DashboardTemplate).filter(
                    DashboardTemplate.name == updates['name'],
                    DashboardTemplate.id != template_id
                ).first()
                
                if existing:
                    raise ValueError(f"模板名 '{updates['name']}' 已存在")
            
            # 更新字段
            for key, value in updates.items():
                if hasattr(template, key):
                    setattr(template, key, value)
            
            template.updated_at = datetime.utcnow()
            
            return self._template_to_dict(template)
    
    def _template_to_dict(self, template: DashboardTemplate) -> Dict[str, Any]:
        """将模板模型转换为字典"""
        if not template:
            return {}
        
        return {
            'id': template.id,
            'name': template.name,
            'description': template.description or '',
            'category': template.category or 'default',
            'panels': template.panels or [],
            'variables': template.variables or [],
            'tags': template.tags or [],
            'is_builtin': template.is_builtin,
            'version': template.version,
            'is_active': template.is_active,
            'created_at': template.created_at.isoformat() if template.created_at else None,
            'updated_at': template.updated_at.isoformat() if template.updated_at else None
        }
    
    # ==================== 数据清理 ====================
    
    def cleanup_duplicate_dashboards(self) -> Dict[str, Any]:
        """清理重复的仪表板"""
        with self.get_session() as session:
            # 查找重复的仪表板（相同标题）
            duplicates = session.query(Dashboard.title).group_by(
                Dashboard.title
            ).having(
                session.query(Dashboard.id).filter(
                    Dashboard.title == Dashboard.title
                ).count() > 1
            ).all()
            
            removed_count = 0
            for (title,) in duplicates:
                # 保留最新的，删除其他的
                dashboards = session.query(Dashboard).filter(
                    Dashboard.title == title
                ).order_by(Dashboard.updated_at.desc()).all()
                
                for dashboard in dashboards[1:]:  # 跳过第一个（最新的）
                    session.delete(dashboard)
                    removed_count += 1
            
            return {
                'removed_count': removed_count,
                'duplicate_titles': [title for (title,) in duplicates]
            }
    
    def cleanup_orphaned_variables(self) -> int:
        """清理孤立的变量（关联的仪表板不存在）"""
        with self.get_session() as session:
            # 查找孤立的变量
            orphaned = session.query(Variable).filter(
                Variable.dashboard_id.isnot(None),
                ~Variable.dashboard_id.in_(
                    session.query(Dashboard.id)
                )
            ).all()
            
            count = len(orphaned)
            for variable in orphaned:
                session.delete(variable)
            
            return count
    
    def cleanup_old_variable_values(self, days: int = 30) -> int:
        """清理旧的变量值记录"""
        from datetime import timedelta
        
        with self.get_session() as session:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            old_values = session.query(VariableValue).filter(
                VariableValue.created_at < cutoff_date
            ).all()
            
            count = len(old_values)
            for value in old_values:
                session.delete(value)
            
            return count

# 单例实例
_enhanced_data_service = None

def get_enhanced_data_service() -> EnhancedDataService:
    """获取增强数据服务实例"""
    global _enhanced_data_service
    if _enhanced_data_service is None:
        _enhanced_data_service = EnhancedDataService()
    return _enhanced_data_service