/**
 * 风险类型分类体系
 * 定义漏洞类型、关键词、解释和推荐操作
 */

export interface RiskType {
  id: string
  name: string
  description: string
  keywords: string[]
  explanation: string
  recommendedActions: string[]
}

export const riskTaxonomy: RiskType[] = [
  {
    id: 'xss',
    name: 'Cross-Site Scripting (XSS)',
    description: '跨站脚本攻击漏洞',
    keywords: [
      'xss', 'cross-site scripting', 'cross site scripting',
      'reflected xss', 'stored xss', 'dom xss',
      'script injection', 'html injection',
      'sanitize', 'sanitization', 'input validation'
    ],
    explanation: '允许攻击者在受害者的浏览器中执行恶意脚本，可能导致会话劫持、数据窃取或钓鱼攻击。',
    recommendedActions: [
      '对所有用户输入进行严格的输出编码（HTML实体编码、JavaScript编码）',
      '实施内容安全策略（CSP）以限制脚本执行',
      '使用安全的框架和库处理用户输入'
    ]
  },
  {
    id: 'rce',
    name: 'Remote Code Execution (RCE)',
    description: '远程代码执行漏洞',
    keywords: [
      'remote code execution', 'code execution', 'rce',
      'execute code', 'arbitrary code', 'command execution',
      'command injection', 'eval', 'deserialization',
      'unserialize', 'pickle', 'marshal'
    ],
    explanation: '允许攻击者在目标系统上执行任意代码，可能导致完全的系统控制。',
    recommendedActions: [
      '避免使用eval()、exec()等危险函数',
      '对用户输入进行严格验证和过滤',
      '使用沙箱环境隔离代码执行',
      '及时更新和修补系统组件'
    ]
  },
  {
    id: 'injection',
    name: 'Injection',
    description: '注入类漏洞（SQL、NoSQL、LDAP等）',
    keywords: [
      'sql injection', 'sqli', 'nosql injection',
      'ldap injection', 'xpath injection', 'command injection',
      'injection vulnerability', 'sql query', 'database query',
      'prepared statement', 'parameterized query'
    ],
    explanation: '允许攻击者通过恶意输入操纵应用程序的查询或命令，可能导致数据泄露、数据篡改或系统控制。',
    recommendedActions: [
      '使用参数化查询或预编译语句',
      '实施最小权限原则',
      '对所有输入进行验证和转义',
      '使用ORM框架避免直接SQL拼接'
    ]
  },
  {
    id: 'privilege',
    name: 'Privilege Escalation',
    description: '权限提升漏洞',
    keywords: [
      'privilege escalation', 'privilege', 'escalation',
      'unauthorized access', 'access control', 'authorization',
      'permission', 'role', 'admin', 'root',
      'bypass authentication', 'authentication bypass'
    ],
    explanation: '允许攻击者获得超出其正常权限的访问权限，可能导致敏感数据访问或系统控制。',
    recommendedActions: [
      '实施最小权限原则和角色基础访问控制（RBAC）',
      '定期审查和更新权限配置',
      '实施多因素认证（MFA）',
      '记录和监控所有权限变更'
    ]
  },
  {
    id: 'auth',
    name: 'Authentication & Brute Force',
    description: '认证和暴力破解漏洞',
    keywords: [
      'authentication', 'login', 'password', 'credential',
      'brute force', 'bruteforce', 'dictionary attack',
      'session', 'token', 'jwt', 'oauth',
      'weak password', 'default password', 'hardcoded credential'
    ],
    explanation: '认证机制存在缺陷，可能允许未授权访问或暴力破解攻击。',
    recommendedActions: [
      '实施账户锁定机制防止暴力破解',
      '使用强密码策略和多因素认证',
      '实施会话管理和超时机制',
      '避免硬编码凭证，使用安全的密钥管理'
    ]
  },
  {
    id: 'disclosure',
    name: 'Information Disclosure',
    description: '信息泄露漏洞',
    keywords: [
      'information disclosure', 'data leak', 'data exposure',
      'sensitive data', 'personal information', 'pii',
      'error message', 'stack trace', 'debug information',
      'directory listing', 'file disclosure', 'path traversal'
    ],
    explanation: '意外泄露敏感信息，可能帮助攻击者了解系统结构或获取敏感数据。',
    recommendedActions: [
      '在生产环境中禁用详细错误信息',
      '实施适当的访问控制和文件权限',
      '对敏感数据进行加密存储',
      '定期审查日志和配置文件'
    ]
  },
  {
    id: 'dos',
    name: 'Denial of Service (DoS)',
    description: '拒绝服务攻击漏洞',
    keywords: [
      'denial of service', 'dos', 'ddos', 'distributed denial',
      'rate limiting', 'resource exhaustion', 'memory exhaustion',
      'cpu exhaustion', 'slowloris', 'flood',
      'timeout', 'hang', 'crash'
    ],
    explanation: '可能导致服务不可用或性能严重下降，影响系统可用性。',
    recommendedActions: [
      '实施速率限制和请求节流',
      '使用负载均衡和自动扩展',
      '实施资源限制和超时机制',
      '监控和检测异常流量模式'
    ]
  },
  {
    id: 'misconfig',
    name: 'Misconfiguration',
    description: '配置错误漏洞',
    keywords: [
      'misconfiguration', 'configuration error', 'default configuration',
      'insecure configuration', 'weak configuration',
      'cors', 'security headers', 'ssl', 'tls',
      'open port', 'unnecessary service', 'debug mode'
    ],
    explanation: '系统或应用程序配置不当，可能暴露不必要的功能或降低安全性。',
    recommendedActions: [
      '遵循安全配置最佳实践',
      '定期审查和更新配置',
      '禁用不必要的服务和功能',
      '实施安全头部（如CSP、HSTS）'
    ]
  }
]

/**
 * 根据文本内容匹配风险类型
 */
export function matchRiskTypes(text: string): RiskType[] {
  const lowerText = text.toLowerCase()
  const matched: RiskType[] = []

  for (const riskType of riskTaxonomy) {
    for (const keyword of riskType.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        if (!matched.find(r => r.id === riskType.id)) {
          matched.push(riskType)
        }
        break
      }
    }
  }

  return matched
}

/**
 * 获取风险类型的显示颜色
 */
export function getRiskTypeColor(riskTypeId: string): string {
  const colors: Record<string, string> = {
    xss: '#f56c6c',
    rce: '#e6a23c',
    injection: '#409eff',
    privilege: '#67c23a',
    auth: '#909399',
    disclosure: '#e6a23c',
    dos: '#f56c6c',
    misconfig: '#909399',
  }
  return colors[riskTypeId] || '#909399'
}

