-- 数据升级：重建准确评分汇总，并对同一客户端标识增加基础写入频率限制。
-- 在备份后由管理员执行；事务锁定评价表，确保回填期间不遗漏写入。
begin;
lock table public.reviews in access exclusive mode;

alter table public.dish_stats add column if not exists rating_sum bigint not null default 0;

create or replace function public.trg_reviews_agg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.dish_stats (dish_id, review_count, rating_sum, avg_rating, updated_at)
    values (new.dish_id, 1, new.rating, new.rating, now())
    on conflict (dish_id) do update set
      review_count = public.dish_stats.review_count + 1,
      rating_sum = public.dish_stats.rating_sum + new.rating,
      avg_rating = round((public.dish_stats.rating_sum + new.rating)::numeric /
                         (public.dish_stats.review_count + 1), 2),
      updated_at = now();
    return new;
  elsif tg_op = 'DELETE' then
    update public.dish_stats set
      review_count = review_count - 1,
      rating_sum = rating_sum - old.rating,
      avg_rating = case when review_count > 1
        then round((rating_sum - old.rating)::numeric / (review_count - 1), 2)
        else null end,
      updated_at = now()
    where dish_id = old.dish_id;
    delete from public.dish_stats where dish_id = old.dish_id and review_count = 0;
    return old;
  end if;
  return null;
end;
$$;
revoke execute on function public.trg_reviews_agg() from public, anon, authenticated;

-- 用明细而非旧均分回填，修复历史累积误差。
delete from public.dish_stats;
insert into public.dish_stats (dish_id, review_count, rating_sum, avg_rating, updated_at)
select dish_id, count(*)::integer, sum(rating), round(avg(rating), 2), now()
from public.reviews group by dish_id;

-- 仅限制同一客户端标识，标识可伪造，不等同于 IP 防刷或身份认证。
create or replace function public.guard_review_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.client_hash is null or char_length(new.client_hash) not between 1 and 64 then
    raise exception 'invalid client identifier' using errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.client_hash, 0));
  if (select count(*) from public.reviews
      where client_hash = new.client_hash and created_at > now() - interval '60 seconds') >= 5 then
    raise exception 'review rate limit exceeded' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function public.guard_review_insert() from public, anon, authenticated;
drop trigger if exists guard_review_insert on public.reviews;
create trigger guard_review_insert before insert on public.reviews
  for each row execute function public.guard_review_insert();

commit;
