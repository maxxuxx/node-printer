<script>
  export let clearLogs;
  export let logs;
  export let openLog;
  export let t;
</script>

<section class="panel log-panel" aria-labelledby="logTitle">
  <div class="panel-head">
    <div>
      <h2 id="logTitle">{t("runLog")}</h2>
      <p>{logs.length} {t("events")}</p>
    </div>
    <button type="button" class="secondary-button" on:click={clearLogs}>{t("clear")}</button>
  </div>

  <div class="log-list" aria-live="polite">
    {#if logs.length === 0}
      <div class="empty-state">{t("noEvents")}</div>
    {/if}

    {#each logs as log (log.id)}
      <button type="button" class="log-item" on:click={(event) => openLog(log, event)}>
        <span>
          <strong>{log.title}</strong>
          <small>{log.time}</small>
        </span>
        <em class:ok={log.ok} class:fail={!log.ok}>{log.ok ? "ok" : log.code}</em>
      </button>
    {/each}
  </div>
</section>

<style>
  .log-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .log-list {
    flex: 1;
    min-height: 0;
    padding: 14px;
  }

  .log-item {
    min-height: 58px;
    border-radius: 8px;
  }
</style>
