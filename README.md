# Espaço — reservas internas

Aplicação em React, Vite, TypeScript e Tailwind CSS para reservar salas de uma empresa. O Firebase SDK roda no navegador: Authentication e Firestore são usados diretamente, sem API própria e sem Cloud Functions.

## Executar localmente

```bash
npm install
npm run dev
```

Sem credenciais Firebase, o app abre em **modo demonstração**. As reservas de demonstração ficam no `localStorage` deste navegador.

## Conectar ao Firebase

1. Crie um projeto Firebase e habilite **Authentication → E-mail/senha**.
2. Crie o Firestore Database.
3. Copie `.env.example` para `.env.local` e preencha as credenciais da aplicação Web Firebase. Defina também `VITE_COMPANY_ID` (o mesmo valor para todos os usuários da empresa) e, opcionalmente, `VITE_WHATSAPP_NUMBER` com o número internacional, apenas dígitos.
4. Publique as regras em `firestore.rules` no Firebase Console ou com Firebase CLI:

   ```bash
   firebase deploy --only firestore:rules --project reservas-ninna
   ```

5. Crie a primeira conta pelo formulário da aplicação. No Firebase Console, localize `users/{uid}` e altere `role` para `admin` e `status` para `approved`. Essa promoção inicial é manual; depois, administradores aprovados podem analisar solicitações na área **Gestão**, escolher o papel e definir o nome e as horas mensais do pacote individual antes de liberar o acesso.
6. Entre novamente na aplicação e, em **Gestão**, cadastre as salas e configure o pacote padrão para contas sem pacote individual. Cada usuário aprovado pode receber um pacote próprio, que também pode ser alterado na ficha do usuário.
7. Reinicie o Vite após alterar variáveis de ambiente:

   ```bash
   npm run dev
   ```

As variáveis `VITE_*` são incluídas no bundle do navegador. As credenciais do Firebase Web identificam o projeto, mas **não** substituem as regras de segurança. Não coloque credenciais de Admin SDK no frontend.

## Como funciona

- A disponibilidade é organizada em blocos de 30 minutos. Use **Adicionar intervalo contínuo** para reservar entre um horário inicial e final (o final não é incluído, então 14:00–15:00 bloqueia 14:00 e 14:30), ou selecione blocos individuais para combinar períodos separados da mesma sala e data.
- O cliente confirma a reserva em uma transação Firestore: cria a reserva, bloqueia os documentos determinísticos em `roomSlots` e atualiza o consumo mensal individual do usuário. O consumo agregado da empresa é calculado a partir das reservas confirmadas.
- Reservas concorrentes para o mesmo horário são recusadas pela transação se o bloco já tiver sido ocupado.
- O limite é aplicado por usuário. Contas sem pacote individual usam o pacote padrão da empresa; se nenhum pacote padrão existir, o limite é de 50 horas. Administradores aprovados inicializam automaticamente o saldo mensal individual de contas existentes ao sincronizar a Gestão.
- Cancelar uma reserva futura libera os blocos e devolve as horas ao mês em que a reserva foi feita.
- Novos cadastros ficam com estado pendente e não podem acessar as funcionalidades da plataforma até a aprovação. Administradores recebem um aviso dentro do app e podem aprovar escolhendo o papel e o pacote individual, ou recusar o acesso.
- Pagamentos e renovações acontecem fora do app. Quando o saldo não cobre a solicitação, a aplicação mostra o contato pelo WhatsApp; o destino deve ser configurado em `VITE_WHATSAPP_NUMBER`.
- O papel do administrador é controlado pelo documento de perfil no Firestore. As regras deixam usuários comuns criarem o próprio perfil apenas com o papel `user`.

## Coleções do Firestore

- `users/{uid}` — perfil, papel, empresa, estado de acesso (`pending`, `approved` ou `rejected`) e pacote individual opcional (`packageLabel`, `monthlyHours`).
- `rooms/{roomId}` — sala, capacidade, horários e empresa.
- `reservations/{reservationId}` — proprietário, data, sala, blocos, duração e estado.
- `roomSlots/{roomId_date_horário}` — bloqueio de um intervalo de 30 minutos.
- `companies/{companyId}/packages/active` — pacote padrão (nome e limite mensal de horas) para contas sem pacote individual.
- `companies/{companyId}/monthlyUsage/{AAAA-MM}` — consumo agregado legado; o painel atual calcula o agregado diretamente das reservas.
- `companies/{companyId}/userMonthlyUsage/{uid_AAAA-MM}` — consumo mensal utilizado por cada usuário, vinculado às reservas e validado contra o pacote individual.

As regras impedem perfis pendentes ou recusados de acessar os dados da empresa, evitam que usuários comuns alterem o próprio papel ou perfis de terceiros, limitam as gravações à empresa e vinculam as alterações de consumo às reservas da transação. A conta de autenticação é criada ao enviar o pedido, mas o acesso ao app só é liberado após aprovação. Como a aplicação não possui código confiável no servidor, mantenha as regras publicadas e revise-as antes de ampliar os fluxos ou permitir operações privilegiadas adicionais.

## Verificação

```bash
npm run build
npm run lint
```
