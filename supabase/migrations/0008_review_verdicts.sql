-- showmi: the two parts of a review that are answers, not tags.
--
-- Run AFTER 0005.
--
-- `tags` already holds how a show felt, and that is genuinely multi-select —
-- a show can be funny and moving at once. These two are not: "worth it" and
-- "too expensive" are the same question, and nothing in an array stops
-- somebody choosing both.
--
-- They also earn their place by being countable. A screen can say "84% would
-- go again" or "most people thought the price was fair"; it cannot say
-- anything equivalent about a bag of adjectives. That was the test for
-- whether structured questions belonged here at all.

alter table public.reviews add column would_return boolean;

-- Three points rather than a number. A 1–5 scale for price invites people to
-- average it, and an average of "how did the price feel" is a statistic
-- about nothing — the ticket cost what it cost, and what varies is whether
-- it felt deserved.
alter table public.reviews add column price_verdict text check (
  price_verdict is null or price_verdict in ('worth_it', 'fair', 'too_much')
);

-- Both are nullable, and stay that way. The rating is the only thing a
-- review must have: a person who felt strongly about a show and has no
-- opinion on its ticket price should be able to say so and stop, and a
-- required field there would collect a guess rather than an answer.
