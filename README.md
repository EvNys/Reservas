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
2. Crie o Firestore Database e habilite o **Firebase Storage**.
3. Copie `.env.example` para `.env.local` e preencha as credenciais da aplicação Web Firebase. Defina `VITE_FIREBASE_STORAGE_BUCKET` com o nome do bucket exibido nas configurações do Storage para habilitar contratos em PDF. Defina também `VITE_COMPANY_ID` com o ID da empresa principal (novos cadastros começam associados a ela; qualquer administrador aprovado pode alocá-los a outra empresa) e, opcionalmente, `VITE_WHATSAPP_NUMBER` com o número internacional, apenas dígitos.
4. Publique as regras de Firestore e Storage (`firestore.rules` e `storage.rules`) no Firebase Console ou com Firebase CLI:

   ```bash
   firebase deploy --only firestore:rules,storage --project reservas-ninna
   ```

5. Crie a primeira conta pelo formulário da aplicação. No Firebase Console, localize `users/{uid}` e altere `role` para `admin` e `status` para `approved`. Essa promoção inicial é manual; qualquer administrador aprovado pode acessar as abas **Empresas** e **Usuários**, protegidas também pelas regras do Firestore. Administradores aprovados consultam e decidem a fila global de solicitações pendentes, inclusive de outras empresas.
6. Entre novamente na aplicação. Em **Empresas**, cadastre as empresas e configure a quantidade mensal de créditos do pacote de cada uma; em **Usuários**, consulte todas as contas e aloque cada uma a uma empresa cadastrada. A alocação preserva o papel e o estado de acesso do usuário. Só é possível excluir uma empresa sem usuários, salas, reservas ou registros de uso vinculados.
7. Cadastre as salas em **Gestão** e defina os créditos cobrados por hora em cada uma. O pacote mensal de créditos da empresa se aplica individualmente a cada usuário associado; a aprovação de usuários não define pacotes individuais.
8. Reinicie o Vite após alterar variáveis de ambiente:

   ```bash
   npm run dev
   ```

As variáveis `VITE_*` são incluídas no bundle do navegador. As credenciais do Firebase Web identificam o projeto, mas **não** substituem as regras de segurança. Não coloque credenciais de Admin SDK no frontend.

## Como funciona

- A disponibilidade é organizada em blocos de 30 minutos e compartilhada entre usuários aprovados da mesma empresa. Use **Adicionar intervalo contínuo** para reservar entre um horário inicial e final (o final não é incluído, então 14:00–15:00 bloqueia 14:00 e 14:30), ou selecione blocos individuais para combinar períodos separados da mesma sala e data.
- O custo da reserva é calculado pela duração multiplicada pela tarifa de créditos por hora da sala. O cliente confirma a reserva em uma transação Firestore: registra o custo aplicado, bloqueia os documentos determinísticos em `roomSlots` e atualiza o consumo mensal individual do usuário. Alterações posteriores na tarifa não afetam reservas existentes.
- O cliente valida os créditos disponíveis e as regras do Firestore verificam novamente o custo e o pacote antes de aceitar a reserva. O consumo agregado é calculado a partir dos custos das reservas confirmadas.
- Reservas concorrentes para o mesmo horário são recusadas pela transação se o bloco já tiver sido ocupado.
- O saldo mensal de créditos do pacote é definido por empresa e aplicado a cada usuário dessa empresa; se não houver pacote configurado, o saldo padrão é de 50 créditos. Administradores aprovados inicializam automaticamente o saldo mensal individual de contas existentes ao sincronizar a Gestão.
- Cancelar uma reserva futura libera os blocos e devolve os créditos ao mês em que a reserva foi feita.
- Novos cadastros ficam com estado pendente e não podem acessar as funcionalidades da plataforma até a aprovação. Administradores recebem um aviso dentro do app e podem aprovar escolhendo o papel ou recusar o acesso.
- O acesso às abas de empresas e usuários exige apenas `role: "admin"` e perfil aprovado. Qualquer administrador aprovado pode criar empresas e alterar a empresa associada a um perfil.
- Pagamentos e renovações de créditos acontecem fora do app. Quando o saldo não cobre a solicitação, a aplicação mostra o contato pelo WhatsApp; o destino deve ser configurado em `VITE_WHATSAPP_NUMBER`.
- O papel do administrador é controlado pelo documento de perfil no Firestore. As regras deixam usuários comuns criarem o próprio perfil apenas com o papel `user`.

## Coleções do Firestore

- `users/{uid}` — perfil, papel, empresa e estado de acesso (`pending`, `approved` ou `rejected`). Campos legados de pacote individual, se existirem, não são mais utilizados.
- `companies/{companyId}` — dados cadastrais e data de cadastro da empresa. Os documentos raiz podem ser criados apenas por administradores aprovados.
- `companies/{companyId}/contracts/{contractId}` — metadados dos contratos em PDF, com arquivos privados no Firebase Storage. O envio é limitado a PDFs de até 15 MB e somente administradores aprovados podem consultar, importar ou remover contratos.
- `rooms/{roomId}` — sala, capacidade, horários, créditos cobrados por hora e empresa.
- `reservations/{reservationId}` — usuário, empresa proprietária da sala, data, sala, blocos, duração em horas, custo em créditos e estado; a agenda é compartilhada entre usuários aprovados.
- `roomSlots/{roomId_date_horário}` — bloqueio de um intervalo de 30 minutos.
- `companies/{companyId}/packages/active` — pacote da empresa (nome e quantidade mensal de créditos), aplicado a cada usuário associado a ela. Sem documento de pacote, o limite é de 50 créditos por mês.
- `companies/{companyId}/monthlyUsage/{AAAA-MM}` — consumo agregado legado; o painel atual calcula o agregado diretamente das reservas.
- `companies/{companyId}/userMonthlyUsage/{uid_AAAA-MM}` — consumo mensal de créditos de cada usuário, vinculado às reservas e validado contra o pacote da empresa.

Documentos legados são lidos de forma compatível durante a migração: pacotes com `monthlyHours` mantêm esse valor como quantidade de créditos, salas sem `creditsPerHour` usam 1 crédito por hora, reservas antigas sem `creditsCost` são consideradas a 1 crédito por hora e registros de uso com `hoursUsed` são tratados como créditos já utilizados. Ao editar pacotes, salas ou fazer novas reservas, os novos campos são gravados.

As regras impedem perfis pendentes ou recusados de acessar salas e reservas, permitem que usuários aprovados compartilhem a agenda da própria empresa e reservem apenas em salas ativas dessa empresa, e vinculam os bloqueios e o consumo às reservas da transação. Usuários comuns só podem cancelar as próprias reservas; administradores da empresa podem gerenciar salas e cancelar reservas de terceiros. Administradores aprovados podem gerenciar pacotes de empresas. A conta de autenticação é criada ao enviar o pedido, mas o acesso ao app só é liberado após aprovação. Como a aplicação não possui código confiável no servidor, mantenha as regras publicadas e revise-as antes de ampliar os fluxos ou permitir operações privilegiadas adicionais.

## Verificação

```bash
npm run build
npm run lint
```
