/**
 * 统一数据服务层 - 管理所有数据的CRUD操作和同步逻辑
 */

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  panels: any[];
  variables: any[];
  tags: string[];
  is_builtin: boolean;
  version?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Variable {
  id: string;
  name: string;
  type: string;
  default_value: string;
  description?: string;
  template_id?: string;
  is_global?: boolean;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  panels: any[];
  variables: any[];
  tags?: string[];
  template_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VariableValue {
  id?: string;
  variable_name: string;
  value: string;
  dashboard_id?: string;
  created_at?: string;
  updated_at?: string;
}

class DataService {
  private baseUrl = '/api';
  private cache = new Map<string, any>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 通用API请求方法
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'API请求失败');
    }

    return result.data;
  }

  /**
   * 缓存管理
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private getCache(key: string): any | null {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  private clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
          this.cacheExpiry.delete(key);
        }
      }
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  // ==================== 模板管理 ====================

  /**
   * 获取所有模板
   */
  async getTemplates(): Promise<Template[]> {
    const cacheKey = 'templates';
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const templates = await this.request<Template[]>('/dashboard-templates');
    this.setCache(cacheKey, templates);
    return templates;
  }

  /**
   * 创建模板
   */
  async createTemplate(template: Partial<Template>): Promise<Template> {
    const result = await this.request<Template>('/dashboard-templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
    this.clearCache('templates');
    return result;
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: string, template: Partial<Template>): Promise<Template> {
    const result = await this.request<Template>(`/dashboard-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
    this.clearCache('templates');
    return result;
  }

  /**
   * 批量同步模板到数据库
   */
  async syncTemplates(templates: Template[]): Promise<any> {
    const result = await this.request('/dashboard-templates/sync', {
      method: 'POST',
      body: JSON.stringify({ templates }),
    });
    this.clearCache('templates');
    return result;
  }

  // ==================== 变量管理 ====================

  /**
   * 获取所有变量
   */
  async getVariables(): Promise<Variable[]> {
    const cacheKey = 'variables';
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const variables = await this.request<Variable[]>('/variables');
    this.setCache(cacheKey, variables);
    return variables;
  }

  /**
   * 创建变量
   */
  async createVariable(variable: Partial<Variable>): Promise<Variable> {
    const result = await this.request<Variable>('/variables', {
      method: 'POST',
      body: JSON.stringify(variable),
    });
    this.clearCache('variables');
    return result;
  }

  /**
   * 保存变量值
   */
  async saveVariableValue(variableName: string, value: string, dashboardId?: string): Promise<VariableValue> {
    const result = await this.request<VariableValue>('/variable-values', {
      method: 'POST',
      body: JSON.stringify({
        variable_name: variableName,
        value,
        dashboard_id: dashboardId,
      }),
    });
    this.clearCache('variable-values');
    return result;
  }

  /**
   * 获取变量值
   */
  async getVariableValues(dashboardId?: string): Promise<VariableValue[]> {
    const cacheKey = `variable-values-${dashboardId || 'global'}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const endpoint = dashboardId ? `/variable-values?dashboard_id=${dashboardId}` : '/variable-values';
    const values = await this.request<VariableValue[]>(endpoint);
    this.setCache(cacheKey, values);
    return values;
  }

  // ==================== 仪表板管理 ====================

  /**
   * 获取所有仪表板
   */
  async getDashboards(): Promise<Dashboard[]> {
    const cacheKey = 'dashboards';
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const dashboards = await this.request<Dashboard[]>('/dashboards');
    this.setCache(cacheKey, dashboards);
    return dashboards;
  }

  /**
   * 创建仪表板
   */
  async createDashboard(dashboard: Partial<Dashboard>): Promise<Dashboard> {
    const result = await this.request<Dashboard>('/dashboards', {
      method: 'POST',
      body: JSON.stringify(dashboard),
    });
    this.clearCache('dashboards');
    return result;
  }

  /**
   * 更新仪表板
   */
  async updateDashboard(id: string, dashboard: Partial<Dashboard>): Promise<Dashboard> {
    const result = await this.request<Dashboard>(`/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dashboard),
    });
    this.clearCache('dashboards');
    return result;
  }

  /**
   * 删除仪表板
   */
  async deleteDashboard(id: string): Promise<void> {
    await this.request(`/dashboards/${id}`, {
      method: 'DELETE',
    });
    this.clearCache('dashboards');
  }

  // ==================== 数据同步 ====================

  /**
   * 从localStorage加载数据
   */
  loadFromLocalStorage<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`从localStorage加载数据失败 (${key}):`, error);
      return null;
    }
  }

  /**
   * 保存数据到localStorage
   */
  saveToLocalStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`保存数据到localStorage失败 (${key}):`, error);
    }
  }

  /**
   * 同步数据到数据库和localStorage
   */
  async syncData<T>(key: string, data: T, saveToDb: (data: T) => Promise<any>): Promise<void> {
    try {
      // 保存到数据库
      await saveToDb(data);
      // 保存到localStorage作为缓存
      this.saveToLocalStorage(key, data);
      // 清除相关缓存
      this.clearCache(key);
    } catch (error) {
      console.error(`数据同步失败 (${key}):`, error);
      // 如果数据库保存失败，至少保存到localStorage
      this.saveToLocalStorage(key, data);
      throw error;
    }
  }

  /**
   * 批量同步操作
   */
  async batchSync(operations: Array<() => Promise<any>>): Promise<any[]> {
    const results = [];
    const errors = [];

    for (const operation of operations) {
      try {
        const result = await operation();
        results.push(result);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      console.warn('批量同步中有部分操作失败:', errors);
    }

    return results;
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.clearCache();
  }
}

// 单例模式
const dataService = new DataService();
export default dataService;