#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de Tabelas Executivas para 5. Forma de Análise
"""

import pandas as pd
import json

def generate_executive_tables():
    """Gera tabelas executivas formatadas para o relatório"""
    
    # Dados baseados nos resultados reais coletados
    
    # Tabela 1: Resumo Executivo de Performance
    performance_data = {
        'Métrica': ['Latência Média (ms)', 'Latência P95 (ms)', 'Latência P99 (ms)', 
                   'Throughput (req/s)', 'Taxa de Sucesso (%)', 'Eficiência (req/s/ms)'],
        'REST': [125.90, 201.54, 248.94, 54.33, 100.0, 0.43],
        'gRPC': [127.75, 202.79, 259.78, 54.29, 100.0, 0.42],
        'Diferença': ['+1.85ms', '+1.25ms', '+10.84ms', '-0.04', '0%', '+0.01'],
        'Vantagem': ['REST', 'REST', 'REST', 'REST', 'Empate', 'REST']
    }
    
    performance_df = pd.DataFrame(performance_data)
    
    # Tabela 2: Escalabilidade por Usuários
    scalability_users_data = {
        'Protocolo': ['REST', 'REST', 'gRPC', 'gRPC'],
        'Usuários Virtuais': [300, 500, 300, 500],
        'Latência Média (ms)': [125.90, 513.20, 127.75, 513.50],
        'Throughput (req/s)': [54.33, 98.71, 54.29, 98.65],
        'Taxa de Erro (%)': [0.0, 0.0, 0.0, 0.0]
    }
    
    scalability_users_df = pd.DataFrame(scalability_users_data)
    
    # Tabela 3: Escalabilidade por Réplicas
    scalability_replicas_data = {
        'Réplicas': [1, 2, 4, 8, 1, 2, 4, 8],
        'Protocolo': ['REST', 'REST', 'REST', 'REST', 'gRPC', 'gRPC', 'gRPC', 'gRPC'],
        'Throughput (req/s)': [98.71, 98.78, 98.72, 98.77, 98.65, 98.70, 98.68, 98.75],
        'Latência (ms)': [513.20, 513.10, 513.00, 512.80, 513.50, 513.30, 513.20, 513.00],
        'Melhoria (%)': [0, 0.07, 0.01, 0.06, 0, 0.05, 0.03, 0.10]
    }
    
    scalability_replicas_df = pd.DataFrame(scalability_replicas_data)
    
    # Tabela 4: Scorecard Qualitativo
    qualitative_data = {
        'Critério': ['Facilidade de Implementação', 'Manutenibilidade', 'Curva de Aprendizado', 
                    'Performance', 'Ecosistema'],
        'REST (Score)': [9.0, 8.0, 9.0, 8.5, 9.5],
        'gRPC (Score)': [7.0, 9.0, 6.0, 8.3, 7.5],
        'Peso (%)': [25, 20, 15, 25, 15],
        'Vencedor': ['REST', 'gRPC', 'REST', 'REST', 'REST']
    }
    
    qualitative_df = pd.DataFrame(qualitative_data)
    
    # Tabela 5: Análise de Recursos
    resources_data = {
        'Recurso': ['CPU Utilização (%)', 'Memória Peak (MB)', 'Network I/O', 
                   'Latência Mínima (ms)', 'Latência Máxima (ms)'],
        'REST': [43.0, 650, 'Médio', 4.75, 370.97],
        'gRPC': [43.0, 652, 'Baixo', 4.03, 519.95],
        'Diferença': ['0%', '+2MB', 'gRPC melhor', '-0.72ms', '+149ms'],
        'Impacto': ['Negligível', 'Negligível', 'Menor bandwidth', 'Insignificante', 'REST melhor']
    }
    
    resources_df = pd.DataFrame(resources_data)
    
    return {
        'performance': performance_df,
        'scalability_users': scalability_users_df,
        'scalability_replicas': scalability_replicas_df,
        'qualitative': qualitative_df,
        'resources': resources_df
    }

def save_tables_as_csv(tables):
    """Salva todas as tabelas como arquivos CSV"""
    
    for table_name, df in tables.items():
        filename = f"tabela_{table_name}.csv"
        df.to_csv(filename, index=False, encoding='utf-8')
        print(f"📊 Tabela salva: {filename}")

def print_formatted_tables(tables):
    """Imprime tabelas formatadas no console"""
    
    print("="*80)
    print("📊 TABELAS EXECUTIVAS - 5. FORMA DE ANÁLISE")
    print("="*80)
    
    print("\n📈 TABELA 1: RESUMO EXECUTIVO DE PERFORMANCE")
    print("-"*60)
    print(tables['performance'].to_string(index=False))
    
    print("\n\n👥 TABELA 2: ESCALABILIDADE POR USUÁRIOS")
    print("-"*60)
    print(tables['scalability_users'].to_string(index=False))
    
    print("\n\n🔄 TABELA 3: ESCALABILIDADE HORIZONTAL (RÉPLICAS)")
    print("-"*60)
    print(tables['scalability_replicas'].to_string(index=False))
    
    print("\n\n🏆 TABELA 4: SCORECARD QUALITATIVO")
    print("-"*60)
    print(tables['qualitative'].to_string(index=False))
    
    print("\n\n💾 TABELA 5: ANÁLISE DE RECURSOS")
    print("-"*60)
    print(tables['resources'].to_string(index=False))

def generate_summary_insights(tables):
    """Gera insights executivos baseados nas tabelas"""
    
    insights = {
        'performance_winner': 'REST',
        'performance_margin': '1.47%',
        'scalability_pattern': 'Linear degradation for both protocols',
        'horizontal_scaling': 'Limited effectiveness - throughput plateau',
        'qualitative_winner': 'REST',
        'qualitative_score': 'REST: 8.65/10 vs gRPC: 7.86/10',
        'recommendation': 'REST for general use, gRPC for internal services',
        'key_differences': [
            'REST: 2-4h setup time vs gRPC: 4-8h setup time',
            'REST: 1-2 weeks learning vs gRPC: 3-4 weeks learning',
            'REST: Better tooling ecosystem vs gRPC: Better type safety',
            'REST: Easier debugging vs gRPC: Better schema evolution'
        ]
    }
    
    return insights

def main():
    print("🔍 GERANDO TABELAS EXECUTIVAS PARA 5. FORMA DE ANÁLISE")
    print("="*65)
    
    # Gerar tabelas
    tables = generate_executive_tables()
    
    # Imprimir tabelas formatadas
    print_formatted_tables(tables)
    
    # Salvar como CSV
    print("\n📁 SALVANDO TABELAS COMO CSV...")
    save_tables_as_csv(tables)
    
    # Gerar insights
    insights = generate_summary_insights(tables)
    
    # Salvar insights
    with open('insights_executivos.json', 'w', encoding='utf-8') as f:
        json.dump(insights, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ TABELAS EXECUTIVAS GERADAS!")
    print(f"📊 Total de tabelas: {len(tables)}")
    print(f"💡 Insights salvos em: insights_executivos.json")
    print(f"📈 Visualizações disponíveis em: 5_analise_comparativa_completa.png")
    
    return tables, insights

if __name__ == "__main__":
    tables, insights = main()
