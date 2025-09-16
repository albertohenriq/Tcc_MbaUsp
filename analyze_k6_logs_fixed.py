import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import glob
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class K6LogAnalyzer:
    def __init__(self, results_dir="results"):
        self.results_dir = Path(results_dir)
        self.results = {}
        
    def load_k6_results(self, pattern="*.json"):
        """Carrega todos os arquivos JSON de resultados do k6"""
        # Buscar em múltiplos diretórios
        search_paths = [
            Path(self.results_dir),
            Path("monitoring-results"),
            Path("k6-results-resilience-improved"),
            Path("k6-results-resilience"),
            Path("k6-results"),
            Path(".")
        ]
        
        json_files = []
        for search_path in search_paths:
            if search_path.exists():
                json_files.extend(list(search_path.glob(pattern)))
        
        for file_path in json_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = []
                    for line_num, line in enumerate(f):
                        try:
                            if line.strip():  # Skip empty lines
                                data.append(json.loads(line.strip()))
                        except json.JSONDecodeError as e:
                            if line_num < 10:  # Only show first few errors
                                print(f"⚠️  JSON error in {file_path.name} line {line_num}: {e}")
                            continue
                    
                    if data:
                        # Remove duplicates by keeping only unique file names
                        if file_path.name not in self.results:
                            self.results[file_path.name] = data
                            print(f"✅ Carregado: {file_path.name} ({len(data)} métricas)")
                        
            except Exception as e:
                print(f"❌ Erro ao carregar {file_path}: {e}")
    
    def extract_metrics(self, data):
        """Extrai métricas específicas dos dados do k6"""
        metrics = {
            'http_req_duration': [],
            'http_requests': [],
            'data_sent': [],
            'data_received': [],
            'iterations': [],
            'checks': [],
            'timestamps': []
        }
        
        for entry in data:
            if entry.get('type') == 'Point' and 'metric' in entry:
                metric_name = entry['metric']
                if 'data' in entry and 'time' in entry['data']:
                    timestamp = entry['data']['time']
                    value = entry['data']['value']
                    
                    if metric_name in metrics:
                        metrics[metric_name].append(value)
                        metrics['timestamps'].append(timestamp)
        
        return metrics
    
    def calculate_percentiles(self, data, metric='http_req_duration'):
        """Calcula percentis P95, P99 para latência"""
        values = []
        for entry in data:
            if (entry.get('metric') == metric and 
                entry.get('type') == 'Point' and 
                'data' in entry and 
                'value' in entry['data']):
                values.append(entry['data']['value'])
        
        if not values:
            return {}
        
        return {
            'p50': np.percentile(values, 50),
            'p95': np.percentile(values, 95),
            'p99': np.percentile(values, 99),
            'mean': np.mean(values),
            'min': np.min(values),
            'max': np.max(values)
        }
    
    def calculate_throughput(self, data):
        """Calcula throughput (req/s)"""
        iterations = []
        timestamps = []
        
        for entry in data:
            if (entry.get('metric') == 'iterations' and 
                entry.get('type') == 'Point' and 
                'data' in entry):
                
                if 'value' in entry['data']:
                    iterations.append(entry['data']['value'])
                if 'time' in entry['data']:
                    timestamps.append(entry['data']['time'])
        
        if not iterations:
            return 0
        
        total_iterations = sum(iterations)
        
        if len(timestamps) < 2:
            return total_iterations / 60  # Assume 60s duration
        
        try:
            start_time = min(timestamps)
            end_time = max(timestamps)
            
            if 'T' in start_time:
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                duration = abs((end_dt - start_dt).total_seconds())
            else:
                return total_iterations / 60
                
        except Exception:
            return total_iterations / 60
        
        return total_iterations / duration if duration > 0 else 0
    
    def calculate_error_rate(self, data):
        """Calcula taxa de erro"""
        total_requests = 0
        failed_requests = 0
        
        for entry in data:
            if entry.get('metric') == 'http_requests' and 'data' in entry:
                total_requests += entry['data'].get('value', 0)
            elif entry.get('metric') == 'http_req_failed' and 'data' in entry:
                failed_requests += entry['data'].get('value', 0)
        
        return (failed_requests / total_requests * 100) if total_requests > 0 else 0
    
    def generate_comprehensive_report(self):
        """Gera relatório completo de análise"""
        if not self.results:
            print("❌ Nenhum resultado carregado. Execute load_k6_results() primeiro.")
            return
        
        report = {
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'total_files': len(self.results),
            'tests': {}
        }
        
        print("🔍 ANÁLISE COMPLETA DOS LOGS K6")
        print("=" * 50)
        
        for filename, data in self.results.items():
            print(f"\\n📊 Análise: {filename}")
            print("-" * 30)
            
            # Métricas básicas
            latency_stats = self.calculate_percentiles(data)
            throughput = self.calculate_throughput(data)
            error_rate = self.calculate_error_rate(data)
            
            test_report = {
                'filename': filename,
                'total_metrics': len(data),
                'latency': latency_stats,
                'throughput_rps': throughput,
                'error_rate_percent': error_rate
            }
            
            report['tests'][filename] = test_report
            
            # Exibir resultados
            if latency_stats:
                print(f"⏱️  Latência (ms):")
                print(f"   - Média: {latency_stats['mean']:.2f}")
                print(f"   - P50: {latency_stats['p50']:.2f}")
                print(f"   - P95: {latency_stats['p95']:.2f}")
                print(f"   - P99: {latency_stats['p99']:.2f}")
                print(f"   - Min/Max: {latency_stats['min']:.2f}/{latency_stats['max']:.2f}")
            
            print(f"🚀 Throughput: {throughput:.2f} req/s")
            print(f"❌ Taxa de Erro: {error_rate:.2f}%")
        
        return report
    
    def create_comparison_visualization(self, output_file="k6_analysis_comparison.png"):
        """Cria visualização comparativa dos resultados mais recentes"""
        if len(self.results) == 0:
            print("❌ Nenhum arquivo disponível para visualização")
            return
        
        # Pegar apenas os arquivos de monitoramento mais recentes
        monitoring_files = {k: v for k, v in self.results.items() 
                          if 'monitoring' in k.lower()}
        
        if not monitoring_files:
            # Se não houver arquivos de monitoring, usar os últimos 4 arquivos
            recent_files = dict(list(self.results.items())[-4:])
        else:
            recent_files = monitoring_files
        
        if len(recent_files) < 1:
            print("❌ Arquivos insuficientes para comparação")
            return
        
        # Preparar dados para visualização
        test_names = []
        throughputs = []
        p95_latencies = []
        error_rates = []
        
        for filename, data in recent_files.items():
            test_names.append(filename.replace('.json', '').replace('_', '\\n'))
            throughputs.append(self.calculate_throughput(data))
            
            latency_stats = self.calculate_percentiles(data)
            p95_latencies.append(latency_stats.get('p95', 0))
            
            error_rates.append(self.calculate_error_rate(data))
        
        # Criar gráfico comparativo
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle('Análise de Performance K6 - Coleta de Dados Completa', fontsize=16)
        
        colors = ['#2E8B57', '#4169E1', '#FF6347', '#FFD700', '#9370DB', '#FF69B4']
        
        # Throughput comparison
        bars1 = ax1.bar(test_names, throughputs, color=colors[:len(test_names)])
        ax1.set_title('Throughput Comparison (req/s)')
        ax1.set_ylabel('Requests per Second')
        ax1.tick_params(axis='x', rotation=45)
        
        # Adicionar valores nas barras
        for bar in bars1:
            height = bar.get_height()
            if height > 0:
                ax1.text(bar.get_x() + bar.get_width()/2., height,
                        f'{height:.1f}', ha='center', va='bottom')
        
        # P95 Latency comparison
        bars2 = ax2.bar(test_names, p95_latencies, color=colors[:len(test_names)])
        ax2.set_title('P95 Latency Comparison (ms)')
        ax2.set_ylabel('Latency (ms)')
        ax2.tick_params(axis='x', rotation=45)
        
        for bar in bars2:
            height = bar.get_height()
            if height > 0:
                ax2.text(bar.get_x() + bar.get_width()/2., height,
                        f'{height:.1f}', ha='center', va='bottom')
        
        # Error Rate comparison
        bars3 = ax3.bar(test_names, error_rates, color=colors[:len(test_names)])
        ax3.set_title('Error Rate Comparison (%)')
        ax3.set_ylabel('Error Rate (%)')
        ax3.tick_params(axis='x', rotation=45)
        
        for bar in bars3:
            height = bar.get_height()
            ax3.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.1f}%', ha='center', va='bottom')
        
        # Performance Score (combinado)
        scores = []
        for t, l, e in zip(throughputs, p95_latencies, error_rates):
            if l > 0 or e > 0:
                score = (t * 100) / (l + e + 1)
            else:
                score = t * 100
            scores.append(score)
            
        bars4 = ax4.bar(test_names, scores, color=colors[:len(test_names)])
        ax4.set_title('Performance Score (Higher = Better)')
        ax4.set_ylabel('Score')
        ax4.tick_params(axis='x', rotation=45)
        
        for bar in bars4:
            height = bar.get_height()
            if height > 0:
                ax4.text(bar.get_x() + bar.get_width()/2., height,
                        f'{height:.0f}', ha='center', va='bottom')
        
        plt.tight_layout()
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        plt.show()
        
        print(f"📊 Gráfico salvo em: {output_file}")
    
    def export_detailed_report(self, output_file="k6_detailed_analysis.json"):
        """Exporta relatório detalhado em JSON"""
        report = self.generate_comprehensive_report()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"📋 Relatório detalhado salvo em: {output_file}")
        return report

def main():
    """Função principal para executar a análise completa"""
    print("🚀 INICIANDO ANÁLISE COMPLETA DOS LOGS K6")
    print("=" * 50)
    
    analyzer = K6LogAnalyzer()
    
    # Carregar todos os resultados JSON
    analyzer.load_k6_results("*.json")
    
    if not analyzer.results:
        print("❌ Nenhum arquivo de resultado encontrado!")
        return
    
    # Gerar relatório completo
    report = analyzer.generate_comprehensive_report()
    
    # Criar visualização
    analyzer.create_comparison_visualization()
    
    # Exportar relatório detalhado
    analyzer.export_detailed_report()
    
    print("\\n✅ ANÁLISE COMPLETA FINALIZADA!")
    print("📊 Verificar arquivos gerados:")
    print("   - k6_analysis_comparison.png")
    print("   - k6_detailed_analysis.json")

if __name__ == "__main__":
    main()
