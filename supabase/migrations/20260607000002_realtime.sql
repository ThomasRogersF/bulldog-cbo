-- Enable Realtime for tables the frontend needs to subscribe to
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table ingredient_ledger;
alter publication supabase_realtime add table shifts;
