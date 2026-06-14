-- Create a public bucket for menu item images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  2097152,       -- 2MB max after compression (client compresses first)
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Anyone authenticated can upload
create policy "authenticated users can upload menu images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'menu-images');

-- Anyone authenticated can update (replace) their uploads
create policy "authenticated users can update menu images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'menu-images');

-- Anyone authenticated can delete menu images
create policy "authenticated users can delete menu images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'menu-images');

-- Public read (the POS tiles show images to everyone authenticated)
create policy "public read menu images"
  on storage.objects for select
  to public
  using (bucket_id = 'menu-images');
