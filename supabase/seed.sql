-- Hive Break · Seed de conteúdo fixo.
-- Fase 1: os 8 níveis (seção 6.1) e as 12 conquistas (seção 9.6).
-- Exercícios, desafios e blocos entram na Fase 3; textos de aviso, na Fase 5.

insert into public.levels (id, ordem, tema, equipamentos_necessarios, avisar_no_nivel) values
  (1, 1, 'Primeiros passos', '{}', null),
  (2, 2, 'Base de movimento', '{}', null),
  (3, 3, 'Equilíbrio e controle', '{}', null),
  (4, 4, 'Ritmo', '{}', null),
  (5, 5, 'Chão firme', '{tapete}', 3),
  (6, 6, 'Potência', '{tapete}', 3),
  (7, 7, 'Amplitude total', '{tapete,cabo_vassoura}', 5),
  (8, 8, 'Desafio final', '{tapete,cabo_vassoura}', 5)
on conflict (id) do update
  set ordem = excluded.ordem, tema = excluded.tema,
      equipamentos_necessarios = excluded.equipamentos_necessarios,
      avisar_no_nivel = excluded.avisar_no_nivel;

insert into public.achievements (id, nome, descricao, criterio) values
  ('primeiro_desafio', 'Primeiro desafio', 'Concluiu o primeiro desafio.', '{"tipo": "desafios_concluidos", "valor": 1}'),
  ('nivel_numa_sessao', 'Fôlego de sobra', 'Completou um nível inteiro numa única sessão.', '{"tipo": "nivel_completo_sessao", "valor": 1}'),
  ('ofensiva_7', 'Ofensiva de 7 dias', 'Sete dias seguidos com pelo menos um desafio.', '{"tipo": "ofensiva", "valor": 7}'),
  ('ofensiva_30', 'Ofensiva de 30 dias', 'Trinta dias seguidos com pelo menos um desafio.', '{"tipo": "ofensiva", "valor": 30}'),
  ('ofensiva_100', 'Ofensiva de 100 dias', 'Cem dias seguidos com pelo menos um desafio.', '{"tipo": "ofensiva", "valor": 100}'),
  ('semana_perfeita', 'Semana perfeita', 'Sete dias seguidos sem usar protetor.', '{"tipo": "semana_perfeita", "valor": 1}'),
  ('nivel_8', 'Desafio final vencido', 'Concluiu o Nível 8.', '{"tipo": "nivel_concluido", "valor": 8}'),
  ('agachamentos_100', '100 agachamentos', 'Somou 100 agachamentos válidos.', '{"tipo": "reps_validas", "exercicio": "agachamento_livre", "valor": 100}'),
  ('arvore_60', 'Raiz firme', 'Postura da árvore por 60 segundos em cada perna.', '{"tipo": "tempo_por_lado", "exercicio": "postura_arvore", "valor": 60}'),
  ('primeiro_amigo', 'Primeiro amigo ativado', 'Um convidado seu concluiu o primeiro desafio.', '{"tipo": "amigos_ativados", "valor": 1}'),
  ('cinco_amigos', '5 amigos ativados', 'Cinco convidados seus concluíram o primeiro desafio.', '{"tipo": "amigos_ativados", "valor": 5}'),
  ('primeira_subida', 'Primeira subida de divisão', 'Subiu de divisão na liga pela primeira vez.', '{"tipo": "subidas_divisao", "valor": 1}'),
  ('nivelamento_melhor', 'Evolução comprovada', 'Refez o nivelamento com melhora.', '{"tipo": "nivelamento_melhora", "valor": 1}')
on conflict (id) do update
  set nome = excluded.nome, descricao = excluded.descricao, criterio = excluded.criterio;
