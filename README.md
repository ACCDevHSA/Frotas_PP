# Fleet Management + Supabase, versão 1

Versão estática para GitHub Pages com banco Supabase. Inclui cards, formulário interno, solicitações pendentes, aprovação, conflito de datas, painel de reservas, registro e links de contrato/checklist.

## 1. Criar o projeto Supabase
1. Acesse o Supabase e crie um projeto.
2. Abra **SQL Editor**.
3. Execute, nesta ordem: `sql/01_schema.sql`, `sql/02_policies_no_login.sql` e `sql/03_seed_vehicles.sql`.
4. Em **Project Settings > API**, copie a URL do projeto e a chave publicável `anon`.
5. Abra `js/config.js` e substitua os dois valores de exemplo.

## 2. Testar localmente
Não abra o HTML com duplo clique. Na pasta do projeto, execute um servidor local, por exemplo:

```bash
python -m http.server 8000
```

Abra `http://localhost:8000`. O painel fica em `http://localhost:8000/painel.html`.

## 3. Publicar no GitHub Pages
1. Faça upload de todo o conteúdo desta pasta para a raiz do repositório.
2. Em **Settings > Pages**, selecione **Deploy from a branch**.
3. Selecione a branch `main` e a pasta `/root`.
4. Salve e abra o endereço informado pelo GitHub.

## 4. Uso
1. O usuário clica em **Request** ou **Request Reservation**.
2. Preenche o formulário e envia.
3. A linha entra como `pending`.
4. Em `painel.html`, clique em **Aprovar** ou **Rejeitar**.
5. Ao aprovar, o banco cria um registro de empréstimo e o site passa a exibir a reserva.
6. Na aba **Registro**, use **Documentos** para vincular as URLs do contrato e do checklist.

## Aviso de segurança
Esta versão não possui autenticação. As políticas de homologação permitem leitura e alterações com a chave pública. Não inclua CPF, CNH, contratos preenchidos ou outros dados pessoais. Não use como versão definitiva. O próximo passo obrigatório antes de produção é Supabase Auth + RLS para administrador.

## Manutenção
- Veículos: tabela `vehicles` no Supabase.
- Solicitações: tabela `reservations`.
- Empréstimos: tabela `loan_records`.
- Templates: pasta `templates`.
- Configuração: `js/config.js`.
