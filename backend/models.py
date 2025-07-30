from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, JSON, Index, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
import os
import uuid

Base = declarative_base()

# 数据库配置
# 优先使用环境变量，否则使用PostgreSQL默认配置
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://rify_user:rify_password@localhost:5432/rify_ops')
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class Dashboard(Base):
    """仪表板模型"""
    __tablename__ = "dashboards"
    
    id = Column(String, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    time_range = Column(String(50), default='1h')
    refresh_interval = Column(Integer, default=30)
    variables = Column(JSON, default=list)  # 存储变量配置
    panels = Column(JSON, default=list)     # 存储面板配置
    tags = Column(JSON, default=list)       # 标签
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_template = Column(Boolean, default=False)  # 是否为模板
    is_public = Column(Boolean, default=True)     # 是否公开
    version = Column(Integer, default=1)  # 版本号
    
    # 添加唯一约束和索引
    __table_args__ = (
        UniqueConstraint('title', name='uq_dashboard_title'),
        Index('idx_dashboard_category', 'category'),
        Index('idx_dashboard_created_at', 'created_at'),
        Index('idx_dashboard_updated_at', 'updated_at'),
    )
    
class Variable(Base):
    """变量模型"""
    __tablename__ = "variables"
    
    id = Column(String, primary_key=True)
    name = Column(String(100), nullable=False)
    label = Column(String(255))
    type = Column(String(50), default='query')  # query, custom, constant, interval, datasource
    query = Column(Text, default='')  # 查询语句
    options = Column(JSON, default=list)    # 可选值列表
    value = Column(JSON, default='')      # 当前值（支持多选）
    multi = Column(Boolean, default=False)      # 是否支持多选
    description = Column(Text, default='')
    refresh = Column(String(50), default='on_dashboard_load')  # 刷新策略
    sort = Column(String(50), default='disabled')  # 排序方式
    include_all = Column(Boolean, default=False)   # 是否包含全选选项
    all_value = Column(String(255), default='')  # 全选时的值
    regex = Column(String(255), default='')      # 正则表达式过滤
    hide = Column(String(50), default='none')  # 隐藏策略
    dashboard_id = Column(String, nullable=True)  # 关联的仪表板ID（可为空表示全局变量）
    template_id = Column(String, nullable=True)  # 关联的模板ID
    is_global = Column(Boolean, default=False)  # 是否为全局变量
    version = Column(Integer, default=1)  # 变量版本
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 添加唯一约束和索引
    __table_args__ = (
        UniqueConstraint('name', 'dashboard_id', name='uq_variable_name_dashboard'),
        Index('idx_variable_name', 'name'),
        Index('idx_variable_dashboard_id', 'dashboard_id'),
        Index('idx_variable_type', 'type'),
        Index('idx_variable_is_global', 'is_global'),
    )
    
class SavedQuery(Base):
    """保存的查询模型"""
    __tablename__ = "saved_queries"
    
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    query = Column(Text, nullable=False)
    description = Column(Text)
    tags = Column(JSON)       # 标签
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_public = Column(Boolean, default=True)  # 是否公开
    
class DashboardTemplate(Base):
    """仪表板模板模型"""
    __tablename__ = "dashboard_templates"
    
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default='')
    category = Column(String(100), default='default')
    panels = Column(JSON, default=list)     # 面板配置模板
    variables = Column(JSON, default=list)  # 变量配置模板
    tags = Column(JSON, default=list)       # 标签
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_builtin = Column(Boolean, default=False)  # 是否为内置模板
    version = Column(String(50), default='1.0.0')  # 模板版本
    is_active = Column(Boolean, default=True)  # 是否激活
    
    # 添加唯一约束和索引
    __table_args__ = (
        UniqueConstraint('name', name='uq_template_name'),
        Index('idx_template_category', 'category'),
        Index('idx_template_is_active', 'is_active'),
        Index('idx_template_created_at', 'created_at'),
    )
    
class VariableValue(Base):
    """变量值历史记录模型"""
    __tablename__ = "variable_values"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    variable_id = Column(String, nullable=False)
    variable_name = Column(String(100), nullable=False)
    value = Column(JSON, default='')      # 变量值
    dashboard_id = Column(String, nullable=True)  # 关联的仪表板ID
    session_id = Column(String, nullable=True)    # 会话ID
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 添加索引
    __table_args__ = (
        Index('idx_variable_value_variable_id', 'variable_id'),
        Index('idx_variable_value_variable_name', 'variable_name'),
        Index('idx_variable_value_dashboard_id', 'dashboard_id'),
        Index('idx_variable_value_session_id', 'session_id'),
        Index('idx_variable_value_created_at', 'created_at'),
    )
    
# 创建所有表
def create_tables():
    """创建数据库表"""
    Base.metadata.create_all(bind=engine)
    
# 初始化数据库
def init_database():
    """初始化数据库，创建表和默认数据"""
    create_tables()
    
    # 创建默认的全局变量
    db = SessionLocal()
    try:
        # 检查是否已有全局变量
        existing_vars = db.query(Variable).filter(Variable.dashboard_id.is_(None)).count()
        if existing_vars == 0:
            # 创建一些默认的全局变量
            default_variables = [
                Variable(
                    id='global_instance',
                    name='instance',
                    label='实例',
                    type='query',
                    query='label_values(up, instance)',
                    value=['192.168.50.81:9090'],
                    multi=True,
                    description='Prometheus实例选择器',
                    refresh='on_dashboard_load'
                ),
                Variable(
                    id='global_job',
                    name='job',
                    label='任务',
                    type='query',
                    query='label_values(up, job)',
                    value=['prometheus'],
                    multi=True,
                    description='Prometheus任务选择器',
                    refresh='on_dashboard_load'
                )
            ]
            
            for var in default_variables:
                db.add(var)
            
            db.commit()
            print("已创建默认全局变量")
            
    except Exception as e:
        print(f"初始化数据库失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
    print("数据库初始化完成")