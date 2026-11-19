-- Hive Break · Conteúdo das trilhas acessórias (Hive Office, Hive Coluna em
-- Dia, Hive Heat, Hive Desacelerar). Ver supabase/migrations/20261125000100_*
-- para o esquema (coluna levels.categoria e os ajustes de trilha_estados e
-- ler_trilha). Roda depois de seed_trilha.sql: as hives abaixo são desafios
-- de um exercício só, e precisam que os exercícios já existam.

insert into public.levels (id, ordem, tema, equipamentos_necessarios, avisar_no_nivel, categoria) values
  (101, 101, 'Hive Office', '{}', null, 'acessoria'),
  (102, 102, 'Hive Coluna em Dia', '{}', null, 'acessoria'),
  (103, 103, 'Hive Heat', '{}', null, 'acessoria'),
  (104, 104, 'Hive Desacelerar', '{}', null, 'acessoria'),
  (105, 105, 'Hive Heat · sem impacto', '{}', null, 'acessoria')
on conflict (id) do update
  set ordem = excluded.ordem, tema = excluded.tema,
      equipamentos_necessarios = excluded.equipamentos_necessarios,
      avisar_no_nivel = excluded.avisar_no_nivel, categoria = excluded.categoria;

insert into public.units (id, level_id, ordem, titulo, descricao) values
  ('u_ha_office', 101, 1, 'Hive Office', 'Mexa o corpo sem sair da mesa nem suar.'),
  ('u_ha_coluna', 102, 1, 'Hive Coluna em Dia', 'Fortalece e solta lombar, pescoço, ombro e punho.'),
  ('u_ha_heat', 103, 1, 'Hive Heat', 'Coração acelerado em poucos minutos.'),
  ('u_ha_desacelerar', 104, 1, 'Hive Desacelerar', 'Solta o corpo e baixa o ritmo pra fechar o dia.'),
  ('u_ha_heat_alt', 105, 1, 'Hive Heat · sem impacto', 'Mesmo ritmo, sem saltar.')
on conflict (id) do update
  set level_id = excluded.level_id, ordem = excluded.ordem, titulo = excluded.titulo, descricao = excluded.descricao;

-- Hive Office: leve, sentado ou em pé, sem chão e sem salto.
insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, tipo, estrutura) values
  ('ha_office_1', 101, 'u_ha_office', 1, 'Elevação de braços em Y', 'mobilidade', 150, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":3,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_office_2', 101, 'u_ha_office', 2, 'Apoio em uma perna', 'equilibrio', 150, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"apoio_uma_perna","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_office_3', 101, 'u_ha_office', 3, 'Postura da árvore', 'yoga', 150, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_office_4', 101, 'u_ha_office', 4, 'Marcha estacionária com braços', 'aquecimento', 150, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":3,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":3,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_office_5', 101, 'u_ha_office', 5, 'Alongamento de posterior em pé', 'alongamento', 150, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_office_6', 101, 'u_ha_office', 6, 'Respiração guiada', 'respiracao', 150, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":3,"esforco_s":30,"pausa_s":15,"score":"tempo_valido","pse_alvo":3,"adm":"completa","acao":"isometrica"}]}'::jsonb)
on conflict (id) do update set titulo = excluded.titulo, modalidade = excluded.modalidade, duracao_s = excluded.duracao_s,
  intensidade = excluded.intensidade, tipo = excluded.tipo, estrutura = excluded.estrutura;

-- Hive Coluna em Dia: moderada, pode ir ao chão, tapete/elástico opcionais.
insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, tipo, estrutura) values
  ('ha_coluna_1', 102, 'u_ha_coluna', 1, 'Ponte de glúteo', 'forca', 210, 'media', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":3,"esforco_s":40,"pausa_s":20,"score":"total_reps","pse_alvo":5,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_coluna_2', 102, 'u_ha_coluna', 2, 'Prancha', 'core', 210, 'media', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"prancha","metodo":"isometria","series":3,"esforco_s":40,"pausa_s":20,"score":"tempo_valido","pse_alvo":5,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_coluna_3', 102, 'u_ha_coluna', 3, 'Elevação de braços em Y', 'mobilidade', 210, 'media', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"elevacao_bracos_y","metodo":"amrap","series":3,"esforco_s":40,"pausa_s":20,"score":"total_reps","pse_alvo":5,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_coluna_4', 102, 'u_ha_coluna', 4, 'Bom-dia com bastão', 'forca', 210, 'media', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"bom_dia_bastao","metodo":"amrap","series":3,"esforco_s":40,"pausa_s":20,"score":"total_reps","pse_alvo":5,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_coluna_5', 102, 'u_ha_coluna', 5, 'Agachamento com bastão acima da cabeça', 'mobilidade', 210, 'media', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"agachamento_bastao","metodo":"amrap","series":3,"esforco_s":40,"pausa_s":20,"score":"total_reps","pse_alvo":5,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_coluna_6', 102, 'u_ha_coluna', 6, 'Alongamento de posterior em pé', 'alongamento', 210, 'media', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":3,"esforco_s":40,"pausa_s":20,"score":"tempo_valido","pse_alvo":5,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_coluna_7', 102, 'u_ha_coluna', 7, 'Cachorro olhando para baixo', 'yoga', 210, 'media', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":3,"esforco_s":40,"pausa_s":20,"score":"tempo_valido","pse_alvo":5,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_coluna_8', 102, 'u_ha_coluna', 8, 'Guerreiro II', 'yoga', 210, 'media', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":3,"esforco_s":40,"pausa_s":20,"score":"tempo_valido","pse_alvo":5,"adm":"completa","acao":"isometrica"}]}'::jsonb)
on conflict (id) do update set titulo = excluded.titulo, modalidade = excluded.modalidade, duracao_s = excluded.duracao_s,
  intensidade = excluded.intensidade, tipo = excluded.tipo, estrutura = excluded.estrutura;

-- Hive Heat: intensa, vai suar. As hives 1, 3 e 7 têm par "sem impacto" (nível 105).
insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, tipo, estrutura) values
  ('ha_heat_1', 103, 'u_ha_heat', 1, 'Polichinelo', 'cardio', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"polichinelo","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_heat_2', 103, 'u_ha_heat', 2, 'Mountain climber', 'condicionamento', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"mountain_climber","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_heat_3', 103, 'u_ha_heat', 3, 'Skipping (elevação de joelhos)', 'cardio', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"skipping","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_heat_4', 103, 'u_ha_heat', 4, 'Agachamento livre', 'forca', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"agachamento_livre","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_heat_5', 103, 'u_ha_heat', 5, 'Afundo alternado', 'forca', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"afundo_alternado","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_heat_6', 103, 'u_ha_heat', 6, 'Flexão de braço', 'forca', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"flexao_braco","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_heat_7', 103, 'u_ha_heat', 7, 'Toque nos alvos', 'precisao', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"toque_alvos","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_heat_8', 103, 'u_ha_heat', 8, 'Ponte de glúteo', 'forca', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"ponte_gluteo","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb)
on conflict (id) do update set titulo = excluded.titulo, modalidade = excluded.modalidade, duracao_s = excluded.duracao_s,
  intensidade = excluded.intensidade, tipo = excluded.tipo, estrutura = excluded.estrutura;

-- Hive Heat · sem impacto: mesmas 3 hives com salto, trocadas por marcha estacionária.
insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, tipo, estrutura) values
  ('ha_heatalt_1', 105, 'u_ha_heat_alt', 1, 'Marcha estacionária com braços', 'aquecimento', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_heatalt_2', 105, 'u_ha_heat_alt', 2, 'Marcha estacionária com braços', 'aquecimento', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb),
  ('ha_heatalt_3', 105, 'u_ha_heat_alt', 3, 'Marcha estacionária com braços', 'aquecimento', 270, 'alta', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":15,"blocos":[{"exercicio_id":"marcha_estacionaria","metodo":"amrap","series":4,"esforco_s":30,"pausa_s":15,"score":"total_reps","pse_alvo":8,"adm":"completa","acao":"mista"}]}'::jsonb)
on conflict (id) do update set titulo = excluded.titulo, modalidade = excluded.modalidade, duracao_s = excluded.duracao_s,
  intensidade = excluded.intensidade, tipo = excluded.tipo, estrutura = excluded.estrutura;

-- Hive Desacelerar: muito leve, sustentações e respiração, melhor à noite.
insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, tipo, estrutura) values
  ('ha_desacelerar_1', 104, 'u_ha_desacelerar', 1, 'Respiração guiada', 'respiracao', 240, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":2,"esforco_s":60,"pausa_s":20,"score":"tempo_valido","pse_alvo":2,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_desacelerar_2', 104, 'u_ha_desacelerar', 2, 'Postura da árvore', 'yoga', 240, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"postura_arvore","metodo":"isometria","series":2,"esforco_s":60,"pausa_s":20,"score":"tempo_valido","pse_alvo":2,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_desacelerar_3', 104, 'u_ha_desacelerar', 3, 'Cachorro olhando para baixo', 'yoga', 240, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"cachorro_olhando_baixo","metodo":"isometria","series":2,"esforco_s":60,"pausa_s":20,"score":"tempo_valido","pse_alvo":2,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_desacelerar_4', 104, 'u_ha_desacelerar', 4, 'Alongamento de posterior em pé', 'alongamento', 240, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"alongamento_posterior","metodo":"isometria","series":2,"esforco_s":60,"pausa_s":20,"score":"tempo_valido","pse_alvo":2,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_desacelerar_5', 104, 'u_ha_desacelerar', 5, 'Guerreiro II', 'yoga', 240, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"guerreiro_2","metodo":"isometria","series":2,"esforco_s":60,"pausa_s":20,"score":"tempo_valido","pse_alvo":2,"adm":"completa","acao":"isometrica"}]}'::jsonb),
  ('ha_desacelerar_6', 104, 'u_ha_desacelerar', 6, 'Respiração guiada', 'respiracao', 240, 'baixa', 'desafio',
   '{"versao":2,"organizacao":"sequencia","pausa_entre_blocos_s":20,"blocos":[{"exercicio_id":"respiracao_guiada","metodo":"isometria","series":2,"esforco_s":60,"pausa_s":20,"score":"tempo_valido","pse_alvo":2,"adm":"completa","acao":"isometrica"}]}'::jsonb)
on conflict (id) do update set titulo = excluded.titulo, modalidade = excluded.modalidade, duracao_s = excluded.duracao_s,
  intensidade = excluded.intensidade, tipo = excluded.tipo, estrutura = excluded.estrutura;

-- challenge_blocks (tabela antiga, ainda lida por carregarDesafio para nome e
-- câmera do exercício): um bloco por hive, igual ao exercício da estrutura.
insert into public.challenge_blocks (id, challenge_id, ordem, exercise_id, formato, series, parametros_por_dificuldade, descanso_s) values
  ('ha_office_1b1', 'ha_office_1', 1, 'elevacao_bracos_y', 'repeticoes', 3, '{"padrao":{"segundos":90}}'::jsonb, 15),
  ('ha_office_2b1', 'ha_office_2', 1, 'apoio_uma_perna', 'equilibrio', 3, '{"padrao":{"segundos":90}}'::jsonb, 15),
  ('ha_office_3b1', 'ha_office_3', 1, 'postura_arvore', 'postura', 3, '{"padrao":{"segundos":90}}'::jsonb, 15),
  ('ha_office_4b1', 'ha_office_4', 1, 'marcha_estacionaria', 'amrap', 3, '{"padrao":{"segundos":90}}'::jsonb, 15),
  ('ha_office_5b1', 'ha_office_5', 1, 'alongamento_posterior', 'isometria', 3, '{"padrao":{"segundos":90}}'::jsonb, 15),
  ('ha_office_6b1', 'ha_office_6', 1, 'respiracao_guiada', 'respiracao', 3, '{"padrao":{"segundos":90}}'::jsonb, 15),
  ('ha_coluna_1b1', 'ha_coluna_1', 1, 'ponte_gluteo', 'repeticoes', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_coluna_2b1', 'ha_coluna_2', 1, 'prancha', 'isometria', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_coluna_3b1', 'ha_coluna_3', 1, 'elevacao_bracos_y', 'repeticoes', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_coluna_4b1', 'ha_coluna_4', 1, 'bom_dia_bastao', 'repeticoes', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_coluna_5b1', 'ha_coluna_5', 1, 'agachamento_bastao', 'repeticoes', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_coluna_6b1', 'ha_coluna_6', 1, 'alongamento_posterior', 'isometria', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_coluna_7b1', 'ha_coluna_7', 1, 'cachorro_olhando_baixo', 'postura', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_coluna_8b1', 'ha_coluna_8', 1, 'guerreiro_2', 'postura', 3, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_heat_1b1', 'ha_heat_1', 1, 'polichinelo', 'repeticoes', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heat_2b1', 'ha_heat_2', 1, 'mountain_climber', 'amrap', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heat_3b1', 'ha_heat_3', 1, 'skipping', 'amrap', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heat_4b1', 'ha_heat_4', 1, 'agachamento_livre', 'repeticoes', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heat_5b1', 'ha_heat_5', 1, 'afundo_alternado', 'repeticoes', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heat_6b1', 'ha_heat_6', 1, 'flexao_braco', 'repeticoes', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heat_7b1', 'ha_heat_7', 1, 'toque_alvos', 'precisao', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heat_8b1', 'ha_heat_8', 1, 'ponte_gluteo', 'repeticoes', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heatalt_1b1', 'ha_heatalt_1', 1, 'marcha_estacionaria', 'amrap', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heatalt_2b1', 'ha_heatalt_2', 1, 'marcha_estacionaria', 'amrap', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_heatalt_3b1', 'ha_heatalt_3', 1, 'marcha_estacionaria', 'amrap', 4, '{"padrao":{"segundos":120}}'::jsonb, 15),
  ('ha_desacelerar_1b1', 'ha_desacelerar_1', 1, 'respiracao_guiada', 'respiracao', 2, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_desacelerar_2b1', 'ha_desacelerar_2', 1, 'postura_arvore', 'postura', 2, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_desacelerar_3b1', 'ha_desacelerar_3', 1, 'cachorro_olhando_baixo', 'postura', 2, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_desacelerar_4b1', 'ha_desacelerar_4', 1, 'alongamento_posterior', 'isometria', 2, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_desacelerar_5b1', 'ha_desacelerar_5', 1, 'guerreiro_2', 'postura', 2, '{"padrao":{"segundos":120}}'::jsonb, 20),
  ('ha_desacelerar_6b1', 'ha_desacelerar_6', 1, 'respiracao_guiada', 'respiracao', 2, '{"padrao":{"segundos":120}}'::jsonb, 20)
on conflict (id) do update set ordem = excluded.ordem, exercise_id = excluded.exercise_id, formato = excluded.formato,
  series = excluded.series, parametros_por_dificuldade = excluded.parametros_por_dificuldade, descanso_s = excluded.descanso_s;
