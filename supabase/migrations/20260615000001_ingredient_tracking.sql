-- Add is_tracked flag to ingredients.
-- true (default) = counted normally; false = infinite/uncounted, excluded from stock logic.
alter table ingredients
  add column is_tracked boolean not null default true;

-- Must drop and recreate because CREATE OR REPLACE cannot insert columns mid-list.
-- Re-grant SELECT to authenticated after recreation (view-level grant).
drop view if exists ingredient_stock;

create view ingredient_stock with (security_invoker = true) as
select
  i.id,
  i.name,
  i.unit,
  i.min_stock,
  i.category_id,
  i.is_tracked,
  ic.name as category_name,
  ic.color as category_color,
  case
    when i.is_tracked then coalesce(sum(il.qty_change), 0)
    else null
  end as current_stock,
  case
    when not i.is_tracked then false
    when i.is_tracked then coalesce(sum(il.qty_change), 0) <= i.min_stock
  end as is_low_stock,
  case
    when not i.is_tracked then false
    when i.is_tracked then coalesce(sum(il.qty_change), 0) <= 0
  end as is_out_of_stock,
  i.deleted_at
from ingredients i
left join ingredient_categories ic on ic.id = i.category_id
left join ingredient_ledger il on il.ingredient_id = i.id
group by i.id, i.name, i.unit, i.min_stock, i.category_id,
         i.is_tracked, ic.name, ic.color, i.deleted_at;

-- Restore view grant lost by drop+recreate.
grant select on ingredient_stock to authenticated, service_role;
