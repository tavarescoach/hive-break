# Hive Break — Bônus por tamanho da hive e bônus de hive completa (18/11/2026)

> Item #3 da ordem de execução (`SOCIAL_CRUZAMENTO_16.md`, seção 5; perguntas 3, 11 e 12).
> Objetivo: dar um motivo concreto e visível para chamar mais gente para a hive, sem punir quem treina sozinho.
> Valores marcados com **[validar]** são padrão até o Luan decidir.

## 1. Princípios
- Sozinho vale 100% do XP. Em grupo vale **mais**, nunca sozinho vale menos.
- Quanto maior a hive, maior o bônus, mas cada pessoa a mais acrescenta um pouco menos (curva que achata), com teto.
- Todo bônus aparece **antes** (para motivar o convite) e **depois** (para celebrar).
- O cálculo é feito no servidor, nunca no celular.

## 2. Quem conta como "concluiu"
Uma pessoa conta para os bônus quando:
- terminou o desafio da hive **com validação de câmera** (modo manual não conta);
- ficou no quadro pelo menos 70% do tempo (mesma regra da liga: mais de 30% fora do quadro não conta);
- inclui quem entrou atrasado, desde que conclua antes de a hive fechar (ver 4.2);
- inclui visitantes (convidados sem cadastro), para que trazer gente nova já renda bônus. **[validar]**

## 3. Bônus por tamanho
Aplicado sobre o **XP base do desafio** de cada participante que concluiu.

**Fórmula:** `bonus% = min(60, round(18,5 × ln(n) − 2,8))`, para `n ≥ 2` (n = número de pessoas que concluíram). Com `n = 1`, bônus 0.

| Pessoas que concluíram | Bônus |
|---|---|
| 1 | 0% |
| 2 | +10% |
| 3 | +18% |
| 4 | +23% |
| 5 | +27% |
| 6 | +30% |
| 8 | +36% |
| 10 | +40% |
| 15 | +47% |
| 20 | +53% |
| 30 ou mais | +60% (teto) |

## 4. Bônus de hive completa

### 4.1 Regra
- **+20% extra** para todos quando **todo mundo que entrou concluiu**. **[validar]**
- Só vale para hives com **4 ou mais** pessoas. Duplas e trios ficam só com o bônus por tamanho. **[validar]**
- Soma com o bônus por tamanho (ex.: 10 pessoas, todos concluíram = +40% + 20% = **+60%**).
- Quem tocar em **"parei por dor ou compromisso"** sai da conta: não impede o bônus dos outros e não é citado em aviso nenhum.
- Quem só abandona, sem marcar o motivo, deixa a hive incompleta.

### 4.2 Fechamento e janela de resgate
- A hive termina quando o último participante ativo acaba.
- Se alguém ficou sem concluir (e sem justificativa), abre uma **janela de 30 min** **[validar]**: a pessoa pode refazer o desafio sozinha e, se concluir, a hive vira completa.
- Durante a janela, quem concluiu vê o aviso (texto de `GANCHOS_CONVITE.md`, seção 3.5): "Falta {nome} para o bônus de hive completa. Chamar para fazer agora?" + botão Chamar no WhatsApp ("Só falta você pra fechar o bônus da hive. Bora?").
- Proteções (de `SOCIAL_CRUZAMENTO_16.md` 3.3): o aviso só aparece para quem estava na mesma hive; nunca no feed nem para gestor; no modo empresa começa desligado.
- Ao fim da janela a hive **fecha de vez** e os bônus são creditados para todos que concluíram (o bônus de completa entra retroativo, se for o caso).
- Enquanto a hive não fecha, o XP base já aparece; o bônus aparece como "pendente".

## 5. Limites (anti-farm)
- Os bônus de hive valem nas **3 primeiras hives do dia** de cada pessoa. Da 4ª em diante, só o XP base. **[validar]**
- Uma pessoa não conta duas vezes na mesma hive.
- O XP com bônus entra na liga normalmente (é XP de desafio com câmera). O teto de 60% (ou 80% com a hive completa) evita vantagem absurda de empresas grandes.

## 6. Onde aparece

### 6.1 Sala de espera (motivar o convite)
- Selo grande: **"Bônus da hive: +27%"**.
- Linha embaixo: "Com mais 1 pessoa: +30%" + botão **Chamar no WhatsApp**.
- Com 4 ou mais: "Todo mundo concluindo: +20% de hive completa."

### 6.2 Durante o exercício
- Na faixa dos colegas, um pequeno contador: "+27% · 5 hiving".

### 6.3 Card de resultado coletivo
- XP base + linhas separadas: "Bônus da hive (5 pessoas) +27%" e "Hive completa +20%".
- Animação curta quando a hive fica completa.
- Se ainda estiver na janela: "Bônus de hive completa pendente: falta 1 pessoa" (sem nome para quem não estava na hive).

### 6.4 Treino sozinho
- No fim: "Em hive esse desafio rendia até +60%. Chame alguém pro próximo." (sem tom de perda).

## 7. Dados
- `hive_participantes`: `status` (`ativo` | `concluiu` | `saiu` | `parou_justificado`), `motivo_parada` (`dor` | `compromisso` | null), `concluiu_em`, `xp_base`, `xp_bonus_tamanho`, `xp_bonus_completa`, `bonus_contou_no_dia` (bool).
- `hives`: `n_concluiram`, `bonus_tamanho_pct`, `completa` (bool), `janela_ate`, `fechada_em`.
- Se houver um extrato de XP (ledger), lançar os bônus como eventos separados: `bonus_hive_tamanho` e `bonus_hive_completa`.
- Fechamento: função no servidor (rota ou função do Supabase) chamada quando o último termina e de novo ao fim da janela (cron a cada minuto ou agendamento).

## 8. Métricas
- Tamanho médio das hives (antes × depois do bônus).
- % de salas de espera em que alguém tocou em "Chamar no WhatsApp".
- % de hives com 4+ que ficam completas; % de avisos "falta fulano" que viram conclusão.
- % de "parei por dor ou compromisso" (se subir muito, revisar a pressão).

## 9. Testes que o código precisa ter
- Tabela da seção 3 batendo com a fórmula (n = 1, 2, 5, 10, 30, 50).
- Hive de 3 com todos concluindo: só tamanho (+18%), sem completa.
- Hive de 5 com 1 "parei por dor": completa conta com 4 → +23% + 20%.
- Hive de 5 com 1 abandono: sem completa; se ele concluir na janela, vira completa (+27% + 20%).
- 4ª hive do dia: só XP base.
- Modo manual e >30% fora do quadro não contam.
