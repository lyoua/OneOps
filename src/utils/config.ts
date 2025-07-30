// 统一配置管理工具
interface AppConfig {
  system: {
    platform_name: string;
    version: string;
    timezone: string;
    language: string;
    theme: string;
    auto_refresh: boolean;
    refresh_interval: number;
  };
  monitoring: {
    prometheus: {
      url: string;
      enabled: boolean;
      timeout: number;
    };
    elk: {
      elasticsearch_url: string;
      enabled: boolean;
      kibana_url: string;
      logstash_url: string;
    };
    grafana: {
      url: string;
      enabled: boolean;
      api_key: string;
    };
  };
  alerts: {
    email: {
      enabled: boolean;
      smtp_server: string;
      smtp_port: number;
      username: string;
      password: string;
      from_email: string;
    };
    webhook: {
      enabled: boolean;
      url: string;
      timeout: number;
    };
    dingtalk: {
      enabled: boolean;
      webhook_url: string;
      secret: string;
    };
  };
  security: {
    session_timeout: number;
    max_login_attempts: number;
    password_policy: {
      min_length: number;
      require_uppercase: boolean;
      require_lowercase: boolean;
      require_numbers: boolean;
      require_special_chars: boolean;
    };
  };
  database: {
    type: string;
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
  };
  custom_indices?: Array<{
    name: string;
    description: string;
    created_at: string;
  }>;
}

class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig | null = null;
  private apiBaseUrl: string = '';
  private prometheusBaseUrl: string = '';
  private configLoadPromise: Promise<void> | null = null;

  private constructor() {
    // 从环境变量或默认值获取后端地址
    this.apiBaseUrl = this.detectBackendUrl();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  // 自动检测后端服务地址
  private detectBackendUrl(): string {
    // 优先级：环境变量 > 当前运行的服务检测 > 默认值
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      
      // 开发环境检测
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // 尝试检测可用的后端端口
        return `${protocol}//192.168.50.81:8001/api`;
      }
      
      // 生产环境
      return `${protocol}//${hostname}/api`;
    }
    
    return 'http://192.168.50.81:8001/api';
  }

  // 异步检测可用的后端服务
  private async detectAvailableBackend(): Promise<string> {
    const possibleUrls = [
      'http://192.168.50.81:8001/api',
      'http://192.168.50.81:8002/api',
      'http://192.168.50.81:8000/api'
    ];

    for (const url of possibleUrls) {
      try {
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          timeout: 3000
        } as any);
        
        if (response.ok) {
          console.log(`检测到可用的后端服务: ${url}`);
          return url;
        }
      } catch (error) {
        // 继续尝试下一个URL
        continue;
      }
    }

    // 如果都不可用，返回默认值
    console.warn('未检测到可用的后端服务，使用默认配置');
    return 'http://192.168.50.81:8001/api';
  }

  // 加载配置
  public async loadConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    if (this.configLoadPromise) {
      await this.configLoadPromise;
      return this.config!;
    }

    this.configLoadPromise = this.doLoadConfig();
    await this.configLoadPromise;
    return this.config!;
  }

  private async doLoadConfig(): Promise<void> {
    try {
      // 首先检测可用的后端服务
      this.apiBaseUrl = await this.detectAvailableBackend();
      
      const response = await fetch(`${this.apiBaseUrl}/config`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        this.config = result.data;
        
        // 设置Prometheus地址
        if (this.config.monitoring?.prometheus?.url) {
          this.prometheusBaseUrl = this.config.monitoring.prometheus.url;
        } else {
          this.prometheusBaseUrl = 'http://192.168.50.81:9090';
        }
        
        console.log('配置加载成功:', this.config);
      } else {
        throw new Error(result.message || '配置加载失败');
      }
    } catch (error) {
      console.error('加载配置失败，使用默认配置:', error);
      
      // 使用默认配置
      this.config = this.getDefaultConfig();
      this.prometheusBaseUrl = 'http://192.168.50.81:9090';
    }
  }

  // 获取默认配置
  private getDefaultConfig(): AppConfig {
    return {
      system: {
        platform_name: '综合运维平台',
        version: '1.0.0',
        timezone: 'Asia/Shanghai',
        language: 'zh-CN',
        theme: 'dark',
        auto_refresh: true,
        refresh_interval: 30
      },
      monitoring: {
        prometheus: {
          url: 'http://192.168.50.81:9090',
          enabled: true,
          timeout: 30
        },
        elk: {
          elasticsearch_url: 'http://192.168.50.81:9200',
          enabled: false,
          kibana_url: 'http://192.168.50.81:5601',
          logstash_url: 'http://192.168.50.81:5044'
        },
        grafana: {
          url: 'http://192.168.50.81:3000',
          enabled: false,
          api_key: ''
        }
      },
      alerts: {
        email: {
          enabled: false,
          smtp_server: '',
          smtp_port: 587,
          username: '',
          password: '',
          from_email: ''
        },
        webhook: {
          enabled: false,
          url: '',
          timeout: 10
        },
        dingtalk: {
          enabled: false,
          webhook_url: '',
          secret: ''
        }
      },
      security: {
        session_timeout: 3600,
        max_login_attempts: 5,
        password_policy: {
          min_length: 8,
          require_uppercase: true,
          require_lowercase: true,
          require_numbers: true,
          require_special_chars: true
        }
      },
      database: {
        type: 'sqlite',
        host: '192.168.50.81',
        port: 5432,
        name: 'ops_platform',
        username: '',
        password: ''
      }
    };
  }

  // 获取API基础URL
  public getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  // 获取Prometheus基础URL
  public getPrometheusBaseUrl(): string {
    return this.prometheusBaseUrl;
  }

  // 获取配置
  public getConfig(): AppConfig | null {
    return this.config;
  }

  // 更新配置
  public async updateConfig(newConfig: Partial<AppConfig>): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 重新加载配置
        this.config = null;
        this.configLoadPromise = null;
        await this.loadConfig();
        return true;
      } else {
        throw new Error(result.message || '更新配置失败');
      }
    } catch (error) {
      console.error('更新配置失败:', error);
      return false;
    }
  }

  // 重新加载配置
  public async reloadConfig(): Promise<AppConfig> {
    this.config = null;
    this.configLoadPromise = null;
    return await this.loadConfig();
  }

  // 检查服务连接状态
  public async checkServiceHealth(): Promise<{
    backend: boolean;
    prometheus: boolean;
    elasticsearch?: boolean;
  }> {
    const status = {
      backend: false,
      prometheus: false,
      elasticsearch: false
    };

    // 检查后端服务
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`, { timeout: 5000 } as any);
      status.backend = response.ok;
    } catch (error) {
      status.backend = false;
    }

    // 检查Prometheus服务
    try {
      const response = await fetch(`${this.prometheusBaseUrl}/api/v1/status/config`, { timeout: 5000 } as any);
      status.prometheus = response.ok;
    } catch (error) {
      status.prometheus = false;
    }

    // 检查Elasticsearch服务（如果配置了）
    if (this.config?.monitoring?.elk?.enabled && this.config.monitoring.elk.elasticsearch_url) {
      try {
        const response = await fetch(`${this.config.monitoring.elk.elasticsearch_url}/_cluster/health`, { timeout: 5000 } as any);
        status.elasticsearch = response.ok;
      } catch (error) {
        status.elasticsearch = false;
      }
    }

    return status;
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();

// 导出类型
export type { AppConfig };

// 便捷函数
export const getApiBaseUrl = () => configManager.getApiBaseUrl();
export const getPrometheusBaseUrl = () => configManager.getPrometheusBaseUrl();
export const loadConfig = () => configManager.loadConfig();
export const updateConfig = (config: Partial<AppConfig>) => configManager.updateConfig(config);
export const reloadConfig = () => configManager.reloadConfig();
export const checkServiceHealth = () => configManager.checkServiceHealth();