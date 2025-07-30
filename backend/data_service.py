#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一数据服务层
负责所有数据的CRUD操作和同步逻辑
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import (
    SessionLocal, 
    Dashboard as DashboardModel,
    Variable as VariableModel,
    SavedQuery as SavedQueryModel,
    DashboardTemplate as DashboardTemplateModel,
    VariableValue as VariableValueModel
)
from datetime import datetime
import json
import uuid
from typing import List, Dict, Any, Optional

class DataService:
    """统一数据服务"""
    
    def __init__(self):
        self.db = SessionLocal()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.db.rollback()
        self.db.close()
    
    # ==================== 模板管理 ====================
    
    def get_all_templates(self, include_inactive: bool = False) -> List[Dict[str, Any]]:
        """获取所有模板"""
        query = self.db.query(DashboardTemplateModel)
        if not include_inactive:
            query = query.filter(DashboardTemplateModel.is_active == True)
        
        templates = query.order_by(DashboardTemplateModel.created_at.desc()).all()
        return [self._template_to_dict(t) for t in templates]
    
    def get_template_by_id(self, template_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取模板"""
        template = self.db.query(DashboardTemplateModel).filter(
            DashboardTemplateModel.id == template_id
        ).first()
        return self._template_to_dict(template) if template else None
    
    def create_template(self, template_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建模板"""
        template_id = template_data.get('id') or f"tpl_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        
        template = DashboardTemplateModel(
            id=template_id,
            name=template_data['name'],
            description=template_data.get('description', ''),
            category=template_data.get('category', '默认'),
            panels=template_data.get('panels', []),
            variables=template_data.get('variables', []),
            tags=template_data.get('tags', []),
            is_builtin=template_data.get('is_builtin', False),
            version=template_data.get('version', '1.0.0'),
            is_active=template_data.get('is_active', True)
        )
        
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        
        return self._template_to_dict(template)
    
    def update_template(self, template_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """更新模板"""
        template = self.db.query(DashboardTemplateModel).filter(
            DashboardTemplateModel.id == template_id
        ).first()
        
        if not template:
            return None
        
        # 更新字段
        for key, value in updates.items():
            if hasattr(template, key):
                setattr(template, key, value)
        
        template.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(template)
        
        return self._template_to_dict(template)
    
    def delete_template(self, template_id: str) -> bool:
        """删除模板（软删除）"""
        template = self.db.query(DashboardTemplateModel).filter(
            DashboardTemplateModel.id == template_id
        ).first()
        
        if not template:
            return False
        
        template.is_active = False
        template.updated_at = datetime.utcnow()
        self.db.commit()
        
        return True
    
    # ==================== 变量管理 ====================
    
    def get_variables(self, dashboard_id: Optional[str] = None, 
                     template_id: Optional[str] = None,
                     global_only: bool = False) -> List[Dict[str, Any]]:
        """获取变量列表"""
        query = self.db.query(VariableModel)
        
        if global_only:
            query = query.filter(VariableModel.is_global == True)
        elif dashboard_id:
            query = query.filter(VariableModel.dashboard_id == dashboard_id)
        elif template_id:
            query = query.filter(VariableModel.template_id == template_id)
        
        variables = query.order_by(VariableModel.created_at.asc()).all()
        return [self._variable_to_dict(v) for v in variables]
    
    def get_variable_by_name(self, name: str, dashboard_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """根据名称获取变量"""
        query = self.db.query(VariableModel).filter(VariableModel.name == name)
        
        if dashboard_id:
            query = query.filter(
                or_(
                    VariableModel.dashboard_id == dashboard_id,
                    VariableModel.is_global == True
                )
            )
        
        variable = query.first()
        return self._variable_to_dict(variable) if variable else None
    
    def create_variable(self, variable_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建变量"""
        variable_id = variable_data.get('id') or f"var_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        
        variable = VariableModel(
            id=variable_id,
            name=variable_data['name'],
            label=variable_data.get('label', variable_data['name']),
            type=variable_data.get('type', 'query'),
            query=variable_data.get('query', ''),
            options=variable_data.get('options', []),
            value=variable_data.get('value'),
            multi=variable_data.get('multi', False),
            description=variable_data.get('description', ''),
            refresh=variable_data.get('refresh', 'on_dashboard_load'),
            sort=variable_data.get('sort', 'disabled'),
            include_all=variable_data.get('include_all', False),
            all_value=variable_data.get('all_value', '*'),
            regex=variable_data.get('regex', ''),
            hide=variable_data.get('hide', 'none'),
            dashboard_id=variable_data.get('dashboard_id'),
            template_id=variable_data.get('template_id'),
            is_global=variable_data.get('is_global', False),
            version=variable_data.get('version', 1)
        )
        
        self.db.add(variable)
        self.db.commit()
        self.db.refresh(variable)
        
        return self._variable_to_dict(variable)
    
    def update_variable(self, variable_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """更新变量"""
        variable = self.db.query(VariableModel).filter(
            VariableModel.id == variable_id
        ).first()
        
        if not variable:
            return None
        
        # 更新字段
        for key, value in updates.items():
            if hasattr(variable, key):
                setattr(variable, key, value)
        
        variable.version += 1
        variable.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(variable)
        
        return self._variable_to_dict(variable)
    
    def save_variable_value(self, variable_name: str, value: Any, 
                           dashboard_id: Optional[str] = None,
                           session_id: Optional[str] = None) -> Dict[str, Any]:
        """保存变量值"""
        # 查找变量
        variable = self.get_variable_by_name(variable_name, dashboard_id)
        if not variable:
            raise ValueError(f"变量 {variable_name} 不存在")
        
        # 更新变量的当前值
        self.update_variable(variable['id'], {'value': value})
        
        # 记录变量值历史
        variable_value = VariableValueModel(
            variable_id=variable['id'],
            variable_name=variable_name,
            value=value,
            dashboard_id=dashboard_id,
            session_id=session_id
        )
        
        self.db.add(variable_value)
        self.db.commit()
        self.db.refresh(variable_value)
        
        return {
            'id': variable_value.id,
            'variable_id': variable_value.variable_id,
            'variable_name': variable_value.variable_name,
            'value': variable_value.value,
            'dashboard_id': variable_value.dashboard_id,
            'session_id': variable_value.session_id,
            'created_at': variable_value.created_at.isoformat()
        }
    
    # ==================== 仪表板管理 ====================
    
    def get_dashboards(self) -> List[Dict[str, Any]]:
        """获取所有仪表板"""
        dashboards = self.db.query(DashboardModel).order_by(
            DashboardModel.updated_at.desc()
        ).all()
        return [self._dashboard_to_dict(d) for d in dashboards]
    
    def create_dashboard(self, dashboard_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建仪表板"""
        dashboard_id = dashboard_data.get('id') or f"dash_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        title = dashboard_data['title']
        
        # 检查是否存在相同ID的仪表板
        existing_by_id = self.db.query(DashboardModel).filter(
            DashboardModel.id == dashboard_id
        ).first()
        
        if existing_by_id:
            # 如果存在相同ID，更新现有记录
            print(f"发现相同ID的仪表板，更新现有记录: {dashboard_id}")
            return self.update_dashboard(dashboard_id, dashboard_data)
        
        # 检查是否存在相同标题的仪表板
        existing_by_title = self.db.query(DashboardModel).filter(
            DashboardModel.title == title
        ).first()
        
        if existing_by_title:
            # 如果存在相同标题，更新现有记录而不是创建新的
            print(f"发现相同标题的仪表板，更新现有记录: {title}")
            return self.update_dashboard(existing_by_title.id, dashboard_data)
        
        # 创建新仪表板
        print(f"创建新仪表板: {dashboard_id}, {title}")
        dashboard = DashboardModel(
            id=dashboard_id,
            title=title,
            description=dashboard_data.get('description', ''),
            category=dashboard_data.get('category', '自定义'),
            time_range=dashboard_data.get('time_range', '1h'),
            refresh_interval=dashboard_data.get('refresh_interval', 30),
            variables=dashboard_data.get('variables', []),
            panels=dashboard_data.get('panels', []),
            tags=dashboard_data.get('tags', []),
            is_template=dashboard_data.get('is_template', False),
            is_public=dashboard_data.get('is_public', True)
        )
        
        self.db.add(dashboard)
        self.db.commit()
        self.db.refresh(dashboard)
        
        return self._dashboard_to_dict(dashboard)
    
    def update_dashboard(self, dashboard_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """更新仪表板"""
        dashboard = self.db.query(DashboardModel).filter(
            DashboardModel.id == dashboard_id
        ).first()
        
        if not dashboard:
            return None
        
        # 更新字段
        for key, value in updates.items():
            if hasattr(dashboard, key):
                setattr(dashboard, key, value)
        
        dashboard.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(dashboard)
        
        return self._dashboard_to_dict(dashboard)
    
    # ==================== 数据同步 ====================
    
    def sync_template_to_database(self, template_data: Dict[str, Any]) -> Dict[str, Any]:
        """同步模板到数据库"""
        existing = self.get_template_by_id(template_data['id'])
        
        if existing:
            return self.update_template(template_data['id'], template_data)
        else:
            return self.create_template(template_data)
    
    def batch_sync_templates(self, templates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """批量同步模板"""
        results = []
        for template in templates:
            try:
                result = self.sync_template_to_database(template)
                results.append(result)
            except Exception as e:
                print(f"同步模板 {template.get('id', 'unknown')} 失败: {e}")
        return results
    
    # ==================== 辅助方法 ====================
    
    def _template_to_dict(self, template: DashboardTemplateModel) -> Dict[str, Any]:
        """模板对象转字典"""
        return {
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'category': template.category,
            'panels': template.panels,
            'variables': template.variables,
            'tags': template.tags,
            'is_builtin': template.is_builtin,
            'version': template.version,
            'is_active': template.is_active,
            'created_at': template.created_at.isoformat(),
            'updated_at': template.updated_at.isoformat()
        }
    
    def _variable_to_dict(self, variable: VariableModel) -> Dict[str, Any]:
        """变量对象转字典"""
        return {
            'id': variable.id,
            'name': variable.name,
            'label': variable.label,
            'type': variable.type,
            'query': variable.query,
            'options': variable.options,
            'value': variable.value,
            'multi': variable.multi,
            'description': variable.description,
            'refresh': variable.refresh,
            'sort': variable.sort,
            'include_all': variable.include_all,
            'all_value': variable.all_value,
            'regex': variable.regex,
            'hide': variable.hide,
            'dashboard_id': variable.dashboard_id,
            'template_id': variable.template_id,
            'is_global': variable.is_global,
            'version': variable.version,
            'created_at': variable.created_at.isoformat(),
            'updated_at': variable.updated_at.isoformat()
        }
    
    def _dashboard_to_dict(self, dashboard: DashboardModel) -> Dict[str, Any]:
        """仪表板对象转字典"""
        return {
            'id': dashboard.id,
            'title': dashboard.title,
            'description': dashboard.description,
            'category': dashboard.category,
            'time_range': dashboard.time_range,
            'refresh_interval': dashboard.refresh_interval,
            'variables': dashboard.variables,
            'panels': dashboard.panels,
            'tags': dashboard.tags,
            'is_template': dashboard.is_template,
            'is_public': dashboard.is_public,
            'created_at': dashboard.created_at.isoformat(),
            'updated_at': dashboard.updated_at.isoformat()
        }

# 全局数据服务实例
def get_data_service() -> DataService:
    """获取数据服务实例"""
    return DataService()