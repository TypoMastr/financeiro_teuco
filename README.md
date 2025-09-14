<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/15DH5djyaoQkJ9bwH8LA0nGYLLh1rGVq0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
   
## Troubleshooting

### Error: "Could not find the 'payable_bill_id' column..."

If you encounter an error like `"Falha ao salvar: Could not find the 'payable_bill_id' column of 'transactions' in the schema cache"`, it means your database schema is missing an update.

**To fix this**, please run the following SQL script in your Supabase project's SQL Editor:

1.  Go to your Supabase project dashboard.
2.  Navigate to the **SQL Editor**.
3.  Click on **+ New query**.
4.  Paste the code below and click **RUN**.

```sql
-- Adiciona a coluna para vincular transações a contas a pagar
alter table public.transactions
  add column payable_bill_id uuid null references public.payable_bills (id) on delete set null;

-- Adiciona um índice para otimizar as buscas por esta coluna
create index if not exists transactions_payable_bill_id_idx on public.transactions (payable_bill_id);

-- Adiciona a restrição de chave estrangeira na tabela de contas a pagar
-- para vincular a transação de pagamento.
-- (Esta parte pode falhar se a restrição já existir, o que é seguro)
alter table public.payable_bills
  add constraint payable_bills_transaction_id_fkey
  foreign key (transaction_id)
  references public.transactions (id) on delete set null;
```

### Error: "Could not find the 'is_estimate' column..."

If you encounter an error like `"Falha ao salvar conta: Could not find the 'is_estimate' column of 'payable_bills' in the schema cache"`, it means your database schema is missing a column for tracking estimated bill amounts.

**To fix this**, please run the following SQL script in your Supabase project's SQL Editor (follow the same steps as above):

```sql
-- Adiciona a coluna para marcar se uma conta a pagar é um valor estimado
alter table public.payable_bills
  add column is_estimate boolean not null default false;
```

This script will update your database structure safely, without any data loss, and resolve the error.