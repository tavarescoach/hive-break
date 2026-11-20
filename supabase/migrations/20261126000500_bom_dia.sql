-- Hive Break · Bom-dia (sem bastão): revisão do Luan na Etapa 1B.
--
-- bom_dia_bastao.catalogo.substitutoE0Id apontava para ponte_gluteo, que é
-- no chão — um substituto E0 ruim para quem está sem o bastão mas também sem
-- chão. bom_dia (mãos na cintura) é o mesmo movimento, em pé, sem bastão: a
-- regra da câmera é idêntica à de bom_dia_bastao porque o bastão nunca era
-- medido (só apoiado nas costas, sem condição própria).
--
-- Mesmo padrão da migração 20261126000200_exercicios_etapa1a.sql: só entra
-- no catálogo (tabela exercises), não em nenhuma unidade ou desafio.
insert into public.exercises (id, nome, modalidade, camera, definicao, equipamento) values
  ('bom_dia', 'Bom-dia', 'forca', 'lateral',
   '{"id":"bom_dia","nome":"Bom-dia","modalidade":"forca","camera":"lateral","formato":"repeticoes","seg_por_rep":3.5,"pontos_obrigatorios":["ombro","quadril","joelho"],"medida_principal":{"tipo":"angulo","pontos":["ombro","quadril","joelho"],"lado":"visivel","espaco":"2d"},"medidas":{"joelho":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"visivel","espaco":"2d"}},"histerese":5,"fases":[{"nome":"topo","condicao":"medida > 155"},{"nome":"fundo","condicao":"medida < 125"}],"repeticao":["topo","fundo","topo"],"parcial_se":"min_medida < 145","parcial_feedback":"Incline mais o tronco","amplitude":{"extremo":"min","minimo_aceito":125,"ideal":90},"duracao_minima_ms":800,"erros":[{"id":"joelhos_dobrados","condicao":"vis(tornozelo) > 0.7 e joelho < 140","fase":"fundo","feedback":"Joelhos quase estendidos","pontos":["joelho_e","joelho_d"]},{"id":"amplitude_curta","quando":"fim_rep","condicao":"min_medida > 110","feedback":"Incline mais o tronco"}],"kpis":["reps_validas","reps_parciais","amplitude_media","indice_tecnico"],"instrucoes":["Fique de lado para o celular, com as mãos na cintura.","Incline o tronco para a frente com os joelhos quase estendidos e volte."],"catalogo":{"nome":"Bom-dia","familia":"dobradura_quadril","degrau":0,"funcoes":["dobrar"],"regioes":["gluteos","lombar","pernas"],"posicaoCamera":"lado","validacao":"V1","equipamento":"E0","flags":{"semChao":true,"semSalto":true,"semSuor":true,"silencioso":true},"pesoPorTrilha":{},"calibrado":false}}'::jsonb,
   null)
on conflict (id) do update set nome = excluded.nome, modalidade = excluded.modalidade, camera = excluded.camera,
  definicao = excluded.definicao, equipamento = excluded.equipamento;

-- Ajusta o substituto E0 e a variação de bom_dia_bastao, que agora é bom_dia
-- (não ponte_gluteo). bom_dia_bastao foi inserido na Etapa 1A
-- (20261126000200_exercicios_etapa1a.sql), antes de existir a chave
-- catalogo: jsonb_set não cria chave intermediária que não existe (só a
-- última do caminho), então um jsonb_set em '{catalogo,substitutoE0Id}' não
-- fazia nada quando `definicao` ainda não tinha `catalogo` nenhum — troca
-- pela definição inteira, como as outras migrações de exercício.
insert into public.exercises (id, nome, modalidade, camera, definicao, equipamento) values
  ('bom_dia_bastao', 'Bom-dia com bastão', 'forca', 'lateral',
   '{"id":"bom_dia_bastao","nome":"Bom-dia com bastão","modalidade":"forca","camera":"lateral","formato":"repeticoes","seg_por_rep":3.5,"pontos_obrigatorios":["ombro","quadril","joelho"],"medida_principal":{"tipo":"angulo","pontos":["ombro","quadril","joelho"],"lado":"visivel","espaco":"2d"},"medidas":{"joelho":{"tipo":"angulo","pontos":["quadril","joelho","tornozelo"],"lado":"visivel","espaco":"2d"}},"histerese":5,"fases":[{"nome":"topo","condicao":"medida > 155"},{"nome":"fundo","condicao":"medida < 125"}],"repeticao":["topo","fundo","topo"],"parcial_se":"min_medida < 145","parcial_feedback":"Incline mais o tronco","amplitude":{"extremo":"min","minimo_aceito":125,"ideal":90},"duracao_minima_ms":800,"erros":[{"id":"joelhos_dobrados","condicao":"vis(tornozelo) > 0.7 e joelho < 140","fase":"fundo","feedback":"Joelhos quase estendidos","pontos":["joelho_e","joelho_d"]},{"id":"amplitude_curta","quando":"fim_rep","condicao":"min_medida > 110","feedback":"Incline mais o tronco"}],"kpis":["reps_validas","reps_parciais","amplitude_media","indice_tecnico"],"instrucoes":["Fique de lado para o celular, com o bastão apoiado nas costas.","Incline o tronco para a frente com os joelhos quase estendidos e volte."],"catalogo":{"nome":"Bom-dia com bastão","familia":"dobradura_quadril","variacaoDe":"bom_dia","degrau":0,"funcoes":["dobrar"],"regioes":["gluteos","lombar","pernas"],"posicaoCamera":"lado","validacao":"V1","equipamento":"E1","objetos":["cabo_vassoura"],"substitutoE0Id":"bom_dia","flags":{"semChao":true,"semSalto":true,"semSuor":true,"silencioso":true},"pesoPorTrilha":{},"calibrado":false}}'::jsonb,
   'cabo_vassoura')
on conflict (id) do update set nome = excluded.nome, modalidade = excluded.modalidade, camera = excluded.camera,
  definicao = excluded.definicao, equipamento = excluded.equipamento;
