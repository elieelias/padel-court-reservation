"use client";

import { Check, Search, UserPlus, Users, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLanguage } from "@/components/language-provider";
import { createClient } from "@/lib/supabase/client";

type FriendshipStatus = "pending" | "accepted" | "rejected";
type FriendshipRow = {
  friendship_id: string;
  player_id: string;
  username: string;
  status: FriendshipStatus;
  direction: "friends" | "incoming" | "outgoing";
};
type SearchRow = {
  player_id: string;
  username: string;
  relationship_status: FriendshipStatus | null;
  relationship_direction: "none" | "friends" | "incoming" | "outgoing";
};

export function FriendManager() {
  const { locale, t } = useLanguage();
  const [connections, setConnections] = useState<FriendshipRow[]>([]);
  const [results, setResults] = useState<SearchRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const { data, error } = await createClient().rpc("list_friendships");
    if (error) setMessage(locale === "ar" ? t("friends.loadError") : error.message || t("friends.loadError"));
    else setConnections((data as FriendshipRow[] | null) ?? []);
    setLoading(false);
  }, [locale, t]);

  useEffect(() => {
    let active = true;
    void createClient().rpc("list_friendships").then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(locale === "ar" ? t("friends.loadError") : error.message || t("friends.loadError"));
      else setConnections((data as FriendshipRow[] | null) ?? []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [locale, t]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("player-friendships")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => void refresh())
      .subscribe();
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const accepted = useMemo(() => connections.filter((item) => item.status === "accepted"), [connections]);
  const incoming = useMemo(() => connections.filter((item) => item.status === "pending" && item.direction === "incoming"), [connections]);
  const outgoing = useMemo(() => connections.filter((item) => item.status === "pending" && item.direction === "outgoing"), [connections]);

  async function searchPlayers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    setMessage("");
    if (trimmedQuery.length < 3) {
      setMessage(t("friends.searchMinimum"));
      return;
    }
    setSearching(true);
    const { data, error } = await createClient().rpc("search_players", { p_query: trimmedQuery });
    setSearching(false);
    if (error) setMessage(locale === "ar" ? t("friends.searchError") : error.message || t("friends.searchError"));
    else {
      const nextResults = (data as SearchRow[] | null) ?? [];
      setResults(nextResults);
      if (!nextResults.length) setMessage(t("friends.noResults"));
    }
  }

  async function sendRequest(playerId: string) {
    setWorkingId(playerId);
    setMessage("");
    const { error } = await createClient().rpc("send_friend_request", { p_player_id: playerId });
    setWorkingId(null);
    if (error) setMessage(locale === "ar" ? t("friends.sendError") : error.message || t("friends.sendError"));
    else {
      setMessage(t("friends.requestSent"));
      setResults((items) => items.map((item) => item.player_id === playerId ? { ...item, relationship_status: "pending", relationship_direction: "outgoing" } : item));
      await refresh();
    }
  }

  async function respond(friendshipId: string, accept: boolean) {
    setWorkingId(friendshipId);
    setMessage("");
    const { error } = await createClient().rpc("respond_friend_request", { p_friendship_id: friendshipId, p_accept: accept });
    setWorkingId(null);
    if (error) setMessage(locale === "ar" ? t("friends.respondError") : error.message || t("friends.respondError"));
    else {
      setMessage(accept ? t("friends.requestAccepted") : t("friends.requestDeclined"));
      await refresh();
    }
  }

  return (
    <section className="panel friends-card">
      <div className="section-heading">
        <div><span className="eyebrow">{t("friends.eyebrow")}</span><h2>{t("friends.title")}</h2></div>
        <Users aria-hidden="true" size={25} />
      </div>
      <p className="friends-card__intro">{t("friends.description")}</p>

      <form className="friend-search" onSubmit={searchPlayers}>
        <label className="sr-only" htmlFor="friend-search">{t("friends.searchLabel")}</label>
        <div><Search aria-hidden="true" size={18} /><input autoCapitalize="none" id="friend-search" onChange={(event) => setQuery(event.target.value)} placeholder={t("friends.searchPlaceholder")} type="search" value={query} /></div>
        <button className="button button--primary" disabled={searching} type="submit">{searching ? t("friends.searching") : t("friends.search")}</button>
      </form>

      {results.length > 0 && (
        <div className="friend-results">
          {results.map((result) => (
            <article className="friend-row" key={result.player_id}>
              <Link className="friend-profile-link" href={`/players/${encodeURIComponent(result.username)}` as Route}><span className="friend-avatar">{result.username.slice(0, 1).toUpperCase()}</span><span><strong>@{result.username}</strong><small>{result.relationship_direction === "friends" ? t("friends.alreadyFriends") : result.relationship_direction === "outgoing" ? t("friends.pending") : result.relationship_direction === "incoming" ? t("friends.waitingForYou") : t("friends.player")}</small></span></Link>
              {result.relationship_direction === "none" && <button aria-label={t("friends.addUser", { username: result.username })} className="friend-icon-button" disabled={workingId === result.player_id} onClick={() => void sendRequest(result.player_id)} type="button"><UserPlus aria-hidden="true" size={18} /></button>}
            </article>
          ))}
        </div>
      )}

      {message && <p className="profile-message" role="status">{message}</p>}

      {incoming.length > 0 && <div className="friend-group friend-group--requests"><h3><span>{t("friends.requests")}</span><b>{incoming.length}</b></h3>{incoming.map((item) => <article className="friend-row" key={item.friendship_id}><Link className="friend-profile-link" href={`/players/${encodeURIComponent(item.username)}` as Route}><span className="friend-avatar">{item.username.slice(0, 1).toUpperCase()}</span><span><strong>@{item.username}</strong><small>{t("friends.wantsToConnect")}</small></span></Link><div className="friend-row__actions"><button aria-label={t("friends.accept")} className="friend-icon-button is-accept" disabled={workingId === item.friendship_id} onClick={() => void respond(item.friendship_id, true)} type="button"><Check aria-hidden="true" size={18} /></button><button aria-label={t("friends.decline")} className="friend-icon-button" disabled={workingId === item.friendship_id} onClick={() => void respond(item.friendship_id, false)} type="button"><X aria-hidden="true" size={18} /></button></div></article>)}</div>}

      <div className="friend-group"><h3>{t("friends.yourFriends", { count: accepted.length })}</h3>{loading ? <p className="friends-empty">{t("common.loading")}</p> : accepted.length ? accepted.map((item) => <article className="friend-row" key={item.friendship_id}><Link className="friend-profile-link" href={`/players/${encodeURIComponent(item.username)}` as Route}><span className="friend-avatar">{item.username.slice(0, 1).toUpperCase()}</span><span><strong>@{item.username}</strong><small>{t("friends.readyToBook")}</small></span></Link></article>) : <p className="friends-empty">{t("friends.noFriends")}</p>}</div>
      {outgoing.length > 0 && <p className="friends-pending-note">{t("friends.outgoing", { count: outgoing.length })}</p>}
    </section>
  );
}
