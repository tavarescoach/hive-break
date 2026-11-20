# Regras da trilha: `trilha_estados`

> Etapa 1A do `docs/PLANO_ETAPAS_UX.md`, item 5. Documento só de leitura: explica a regra
> que está valendo hoje no banco, a partir das migrações que a definem, sem mudar código.

`public.trilha_estados(p_user uuid)` é a função que decide, para cada desafio, qual é o
estado dele para uma pessoa: `concluido`, `travado`, `disponivel` ou `bloqueado`. É lida por
`ler_trilha()` (tela da trilha), por `finalizar_desafio` (para recusar um desafio bloqueado) e
por `ler_trilhas_acessorias()`.

Foi criada em `20261117000600_trilha_unidades.sql` e redefinida (`create or replace`) outras
duas vezes: `20261122000100_visitante.sql` e `20261125000100_trilhas_acessorias.sql`. A versão
que vale é sempre a última a rodar — como as migrações são aplicadas em ordem pelo nome do
arquivo (data), a de `25/11` é a regra vigente hoje.

## Como funciona (a versão vigente)

1. **`base`**: para cada desafio (`challenges`), calcula:
   - `seq`: a posição dele dentro da seção (`level_id`), contando unidade por unidade, na
     ordem de `units.ordem` e depois `challenges.ordem`. É a "fila" da seção inteira.
   - `feito`: se já existe `user_challenge_progress.concluido_em` para esse desafio.
   - `permitido`: se a intensidade do desafio pode ser feita por esta pessoa agora (ver
     "Travado" abaixo).
   - `secao_liberada`: se a seção (nível) em que o desafio está foi liberada para esta
     pessoa (`user_level_progress.liberado`) — **ou**, desde `25/11`, se o desafio é de uma
     trilha acessória, que não depende de liberação de seção nenhuma.
2. **`marcado`**: para cada desafio, `pendente_antes` = existe algum desafio **antes dele na
   mesma seção** (mesmo `seq` menor) que é `permitido` e ainda não foi `feito`. É uma janela
   (`bool_or(...) over (partition by level_id order by seq rows ... 1 preceding)`), ou seja,
   olha só para trás, nunca para a frente.
3. **Estado final**, nessa ordem de prioridade:
   - `concluido`: `feito` é verdadeiro (não importa o resto).
   - `travado`: não é `permitido` (ver abaixo) — mas isso **não trava a fila**: um desafio
     travado não entra no cálculo de `pendente_antes` dos desafios depois dele, então quem
     está limitado continua vendo os próximos desafios como disponíveis, só pulando os que
     não pode fazer.
   - `disponivel`: a seção está liberada **e** não há nada pendente antes na fila.
   - `bloqueado`: sobra deste (seção não liberada, ou tem algo pendente antes).

### Travado: liberado para intensidade × restrição de saúde

`permitido` depende de duas coisas do perfil (`profiles`), não de uma trava fixa por nível:

- **Sem restrição de saúde** (`triagem_restricao = false`): `permitido` = intensidade baixa
  **ou** `liberado_alta_intensidade = true`. Ou seja, quem não pode (ou não quer) intensidade
  média/alta vê esses desafios como `travado`, mas segue pelos de intensidade baixa.
- **Com restrição de saúde** (`triagem_restricao = true`, da declaração do visitante ou da
  triagem antiga): só é `permitido` respiração, ou mobilidade de intensidade baixa. Tudo o
  resto — incluindo força e cardio de intensidade baixa — fica `travado`. É mais restritivo
  do que o caso sem restrição.

### Trilhas acessórias (Modo Escritório e companhia)

Desde `25/11`, `secao_liberada` é sempre `true` para desafios de uma seção com
`levels.categoria = 'acessoria'`, independente de `user_level_progress`. Essas trilhas vivem
fora da progressão principal: a pessoa não "libera" o Modo Escritório fazendo a trilha
principal, ele já está disponível (sujeito só à regra de `travado` acima).

## As 3 migrações, na ordem

| Migração | O que mudou em `trilha_estados` |
|---|---|
| `20261117000600_trilha_unidades.sql` | Criação. `permitido` = `liberado_alta_intensidade or intensidade = 'baixa'`. `secao_liberada` = `user_level_progress.liberado`, sem exceção. |
| `20261122000100_visitante.sql` | `permitido` passa a considerar `triagem_restricao`: quem declarou alguma restrição de saúde só tem `permitido` respiração ou mobilidade de baixa intensidade (antes, só olhava `liberado_alta_intensidade`). `secao_liberada` não muda. |
| `20261125000100_trilhas_acessorias.sql` | `secao_liberada` passa a ser sempre `true` para desafios de uma seção `categoria = 'acessoria'` (precisa de um novo `join` com `levels` para ler a categoria). `permitido` não muda nesta migração. |

Nenhuma das três mudou a prioridade dos estados (`concluido` > `travado` > `disponivel` >
`bloqueado`) nem o cálculo de `pendente_antes`: só os critérios de `permitido` e
`secao_liberada` foram ajustados.
