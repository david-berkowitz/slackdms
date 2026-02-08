"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

type ActiveUser = {
  user_id: string;
  display_name: string | null;
  real_name: string | null;
  last_activity_at: string | null;
  channel_name?: string | null;
};

type Sender = {
  user_id: string;
  display_name: string | null;
  real_name: string | null;
};

type Channel = {
  channel_id: string;
  name: string | null;
  is_private: boolean | null;
};

type Workspace = {
  team_id: string;
  team_name: string | null;
};

type Workflow = {
  id: string;
  name: string;
  trigger: string;
  sender_user_id: string | null;
  channel_id: string | null;
  message_template: string;
  is_active: boolean;
};

const triggerOptions = [
  { value: "team_join", label: "New member joins workspace" },
  { value: "member_joined_channel", label: "Member joins a channel" },
];

export default function AdminPage() {
  const [teamId, setTeamId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [message, setMessage] = useState(
    "Hey {{first_name}}, wanted to share this with you..."
  );
  const [status, setStatus] = useState<string | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [batchSender, setBatchSender] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workflowName, setWorkflowName] = useState("Welcome DM");
  const [workflowTrigger, setWorkflowTrigger] = useState("team_join");
  const [workflowSender, setWorkflowSender] = useState<string | null>(null);
  const [workflowChannel, setWorkflowChannel] = useState<string | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState(
    "Hey {{first_name}}, welcome to the community!"
  );
  const [backfillDays, setBackfillDays] = useState(30);

  useEffect(() => {
    setUsers([]);
  }, [teamId, channelId, days]);

  useEffect(() => {
    setSenders([]);
    setWorkflows([]);
    setChannels([]);
    if (teamId) {
      void loadSenders();
      void loadWorkflows();
      void loadChannels();
    }
  }, [teamId]);

  const channelNameMap = useMemo(() => {
    return new Map(channels.map((channel) => [channel.channel_id, channel.name]));
  }, [channels]);

  const channelOptions = useMemo(() => {
    return channels.map((channel) => ({
      value: channel.channel_id,
      label: channel.name ?? channel.channel_id,
    }));
  }, [channels]);

  const senderOptions = useMemo(() => {
    return senders.map((sender) => ({
      value: sender.user_id,
      label: sender.display_name || sender.real_name || sender.user_id,
    }));
  }, [senders]);

  const loadActive = async () => {
    if (!teamId) {
      setStatus("Add a workspace team ID first.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams({
        team_id: teamId,
        days: days.toString(),
      });
      if (channelId) {
        params.set("channel_id", channelId);
      }
      const res = await fetch(`/api/active?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load active users.");
      }
      setUsers(data.users ?? []);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to load active users."
      );
    } finally {
      setLoading(false);
    }
  };

  const startDmJob = async () => {
    if (!teamId) {
      setStatus("Add a workspace team ID first.");
      return;
    }
    if (!message.trim()) {
      setStatus("Add a message template before sending.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/dm-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          channel_id: channelId || null,
          days,
          message_template: message,
          sender_user_id: batchSender,
          limit: 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to create DM job.");
      }
      setStatus(`Queued DM job ${data.job_id}.`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to create DM job."
      );
    } finally {
      setLoading(false);
    }
  };

  const runQueueNow = async () => {
    if (!teamId) {
      setStatus("Add a workspace team ID first.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/dm-jobs/process-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, max_jobs: 3, batch_size: 20 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to run DM queue.");
      }
      setStatus(
        `Queue processed: ${data.jobs_processed ?? 0} job(s), ${data.messages_sent ?? 0} message(s).`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to run queue.");
    } finally {
      setLoading(false);
    }
  };

  const syncUsers = async () => {
    if (!teamId) {
      setStatus("Add a workspace team ID first.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/slack/sync-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to sync users.");
      }
      setStatus(`Synced ${data.count} users.`);
      await loadSenders();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to sync users."
      );
    } finally {
      setLoading(false);
    }
  };

  const syncChannels = async () => {
    if (!teamId) {
      setStatus("Add a workspace team ID first.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/slack/sync-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to sync channels.");
      }
      setStatus(`Synced ${data.count} channels.`);
      await loadChannels();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to sync channels."
      );
    } finally {
      setLoading(false);
    }
  };

  const detectWorkspaces = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/workspaces");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load connected workspaces.");
      }
      setWorkspaces(data.workspaces ?? []);
      if ((data.workspaces ?? []).length === 1) {
        setTeamId(data.workspaces[0].team_id);
      }
      setStatus("Loaded connected workspaces.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to load connected workspaces."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSenders = async () => {
    const res = await fetch(`/api/senders?team_id=${teamId}`);
    const data = await res.json();
    if (res.ok) {
      setSenders(data.senders ?? []);
    }
  };

  const loadWorkflows = async () => {
    const res = await fetch(`/api/workflows?team_id=${teamId}`);
    const data = await res.json();
    if (res.ok) {
      setWorkflows(data.workflows ?? []);
    }
  };

  const loadChannels = async () => {
    const res = await fetch(`/api/channels?team_id=${teamId}`);
    const data = await res.json();
    if (res.ok) {
      setChannels(data.channels ?? []);
    }
  };

  const createWorkflow = async () => {
    if (!teamId) {
      setStatus("Add a workspace team ID first.");
      return;
    }
    if (!workflowName.trim() || !workflowMessage.trim()) {
      setStatus("Add a workflow name and message.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          name: workflowName,
          trigger: workflowTrigger,
          channel_id:
            workflowTrigger === "member_joined_channel" ? workflowChannel : null,
          sender_user_id: workflowSender,
          message_template: workflowMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to create workflow.");
      }
      setStatus("Workflow created.");
      await loadWorkflows();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to create workflow."
      );
    } finally {
      setLoading(false);
    }
  };

  const runBackfill = async (workflow: Workflow) => {
    if (!teamId) {
      setStatus("Add a workspace team ID first.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/workflows/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          workflow_id: workflow.id,
          days: backfillDays,
          limit: 200,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to backfill workflow.");
      }
      setStatus(`Backfill sent to ${data.processed ?? 0} members.`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to backfill workflow."
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = async (workflow: Workflow) => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/workflows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workflow.id,
          team_id: teamId,
          name: workflow.name,
          trigger: workflow.trigger,
          channel_id: workflow.channel_id ?? null,
          sender_user_id: workflow.sender_user_id,
          message_template: workflow.message_template,
          is_active: !workflow.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to update workflow.");
      }
      await loadWorkflows();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to update workflow."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Admin Console</p>
          <h1>Community activity and outreach</h1>
        </div>
        <a className={styles.install} href="/api/slack/install">
          Install Slack App
        </a>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Workspace settings</h2>
          <p>Enter a workspace ID (starts with T) or detect it automatically.</p>
        </div>
        <div className={styles.buttonRow}>
          <button onClick={detectWorkspaces} disabled={loading}>
            {loading ? "Loading..." : "Find connected workspaces"}
          </button>
        </div>
        {workspaces.length > 0 ? (
          <div className={styles.formRow}>
            <label>
              Pick connected workspace
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                <option value="">Select one</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.team_id} value={workspace.team_id}>
                    {(workspace.team_name ?? "Unnamed workspace") +
                      " (" +
                      workspace.team_id +
                      ")"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div className={styles.formRow}>
          <label>
            Team ID
            <input
              value={teamId}
              onChange={(event) => setTeamId(event.target.value.trim())}
              placeholder="T0123ABCD"
            />
          </label>
          <label>
            Channel ID (optional)
            <input
              value={channelId}
              onChange={(event) => setChannelId(event.target.value.trim())}
              placeholder="C0456EFGH"
            />
          </label>
          <label>
            Lookback (days)
            <input
              type="number"
              min={7}
              max={365}
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.card}>
          <h3>Active members</h3>
          <p>Messages and reactions across public channels.</p>
          <button onClick={loadActive} disabled={loading}>
            {loading ? "Loading..." : "Load active users"}
          </button>
        </div>
        <div className={styles.card}>
          <h3>DM batch</h3>
          <p>Queue up to 100 DMs with rate-limit pacing.</p>
          <button onClick={startDmJob} disabled={loading}>
            {loading ? "Queuing..." : "Queue DM batch"}
          </button>
          <button onClick={runQueueNow} disabled={loading}>
            {loading ? "Running..." : "Run queue now"}
          </button>
        </div>
        <div className={styles.card}>
          <h3>Sync workspace</h3>
          <p>Pull the latest users and channels.</p>
          <div className={styles.buttonRow}>
            <button onClick={syncUsers} disabled={loading}>
              Sync users
            </button>
            <button onClick={syncChannels} disabled={loading}>
              Sync channels
            </button>
          </div>
        </div>
        <div className={styles.card}>
          <h3>Status</h3>
          <p>{status ?? "Ready to connect a workspace."}</p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Message template</h2>
          <p>{"Use {{first_name}} or {{display_name}} placeholders."}</p>
        </div>
        <textarea
          className={styles.textarea}
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />

        <div className={styles.formRow}>
          <label>
            Sender for batch DMs
            <select
              value={batchSender ?? ""}
              onChange={(event) => setBatchSender(event.target.value || null)}
            >
              <option value="">Default (latest authorized)</option>
              {senderOptions.map((sender) => (
                <option key={sender.value} value={sender.value}>
                  {sender.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>DM workflows</h2>
          <p>
            {
              "Triggers: new member joins workspace or joins channel. Placeholders: {{first_name}}, {{display_name}}, {{real_name}}, {{channel_id}}."
            }
          </p>
        </div>
        <div className={styles.workflowGrid}>
          <label>
            Workflow name
            <input
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
            />
          </label>
          <label>
            Trigger
            <select
              value={workflowTrigger}
              onChange={(event) => setWorkflowTrigger(event.target.value)}
            >
              {triggerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sender account
            <select
              value={workflowSender ?? ""}
              onChange={(event) => setWorkflowSender(event.target.value || null)}
            >
              <option value="">Default (latest authorized)</option>
              {senderOptions.map((sender) => (
                <option key={sender.value} value={sender.value}>
                  {sender.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Channel target (for channel-join trigger)
            <select
              value={workflowChannel ?? ""}
              onChange={(event) => setWorkflowChannel(event.target.value || null)}
              disabled={workflowTrigger !== "member_joined_channel"}
            >
              <option value="">All channels</option>
              {channelOptions.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          className={styles.textarea}
          rows={3}
          value={workflowMessage}
          onChange={(event) => setWorkflowMessage(event.target.value)}
        />
        <div className={styles.workflowActions}>
          <div className={styles.workflowBackfill}>
            <label>
              Backfill days
              <input
                type="number"
                min={1}
                max={365}
                value={backfillDays}
                onChange={(event) => setBackfillDays(Number(event.target.value))}
              />
            </label>
          </div>
          <button onClick={createWorkflow} disabled={loading}>
            {loading ? "Saving..." : "Create workflow"}
          </button>
        </div>
        <div className={styles.workflowList}>
          {workflows.length === 0 ? (
            <p className={styles.empty}>No workflows yet.</p>
          ) : (
            workflows.map((workflow) => (
              <div key={workflow.id} className={styles.workflowRow}>
                <div>
                  <p className={styles.name}>{workflow.name}</p>
                  <p className={styles.detail}>
                    Trigger: {workflow.trigger.replaceAll("_", " ")}
                    {workflow.channel_id
                      ? ` • Channel: ${channelNameMap.get(workflow.channel_id) ?? workflow.channel_id}`
                      : ""}
                  </p>
                </div>
                <div className={styles.workflowButtons}>
                  <button
                    className={styles.toggle}
                    onClick={() => toggleWorkflow(workflow)}
                    disabled={loading}
                  >
                    {workflow.is_active ? "Pause" : "Activate"}
                  </button>
                  <button
                    className={styles.outline}
                    onClick={() => runBackfill(workflow)}
                    disabled={loading}
                  >
                    Backfill
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Active member list</h2>
          <p>Showing the latest activity we have stored.</p>
        </div>
        <div className={styles.list}>
          {users.length === 0 ? (
            <p className={styles.empty}>
              No users loaded yet. Connect a workspace and click Load active users.
            </p>
          ) : (
            users.map((user) => (
              <div key={user.user_id} className={styles.listRow}>
                <div>
                  <p className={styles.name}>
                    {user.display_name || user.real_name || user.user_id}
                  </p>
                  <p className={styles.detail}>
                    Last active:{" "}
                    {user.last_activity_at
                      ? new Date(user.last_activity_at).toLocaleString()
                      : "unknown"}
                  </p>
                </div>
                <span className={styles.tag}>{user.channel_name ?? "All channels"}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
