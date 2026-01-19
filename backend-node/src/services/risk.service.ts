// Risk calculation is handled by Python ML service
// This service provides helper methods for risk-related operations

export class RiskService {
  static getRiskLevel(riskScore: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (riskScore < 0.40) return 'Low';
    if (riskScore < 0.70) return 'Medium';
    if (riskScore < 0.90) return 'High';
    return 'Critical';
  }

  static getRiskLevelColor(riskLevel: string): string {
    const colors: Record<string, string> = {
      Low: '#67C23A',
      Medium: '#E6A23C',
      High: '#F56C6C',
      Critical: '#F56C6C',
    };
    return colors[riskLevel] || '#909399';
  }
}

















