<script>
  export let appCaption;
  export let appTitle;
  export let capabilities;
  export let capabilityClass;
  export let capabilityLabel;
  export let capabilityNames;
  export let changeLanguage;
  export let healthDetail;
  export let healthOk;
  export let language;
  export let languageOptions;
  export let pendingStatus;
  export let refreshStatus;
  export let t;
</script>

<header class="topbar">
  <div class="topbar-title">
    <h1>{appTitle}</h1>
    <div class="caption">{appCaption}</div>
  </div>

  <div class="topbar-status" aria-live="polite">
    {#each capabilityNames as name}
      <strong class={`mini-badge ${capabilityClass(capabilities[name])}`}>
        {name} {capabilityLabel(capabilities[name])}
      </strong>
    {/each}
  </div>

  <div class="topbar-actions">
    <label class="language-field">
      <span>{t("language")}</span>
      <select bind:value={language} on:change={changeLanguage}>
        {#each languageOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>

    <strong class:ok={healthOk} class:fail={!healthOk} class="status-badge" title={JSON.stringify(healthDetail)}>
      {healthOk ? t("healthy") : t("unhealthy")}
    </strong>
    <button type="button" class="secondary-button" disabled={pendingStatus} on:click={refreshStatus}>
      {pendingStatus ? t("refreshing") : t("refresh")}
    </button>
  </div>
</header>

<style>
  .topbar {
    min-height: 62px;
    padding: 10px 16px;
  }

  .topbar-title {
    display: grid;
    gap: 1px;
    min-width: 180px;
  }

  .topbar-title h1 {
    font-size: 20px;
    line-height: 1.15;
  }

  .topbar-status {
    display: flex;
    flex: 1;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }

  .topbar-actions {
    flex: 0 0 auto;
  }

  .language-field {
    min-width: 116px;
  }

  .language-field select {
    min-height: 34px;
  }

  .status-badge,
  .mini-badge {
    min-height: 24px;
    padding: 0 9px;
    font-size: 11px;
  }

  @media (max-width: 980px) {
    .topbar {
      align-items: stretch;
      flex-direction: column;
    }

    .topbar-actions {
      align-items: stretch;
    }

    .language-field {
      width: 100%;
    }
  }
</style>
