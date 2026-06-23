<script>
  export let disabled  = false;
  export let emptyText = "No targets";
  export let getLabel;
  export let getValue;
  export let items     = [];
  export let onSelect  = () => {};
  export let title;
  export let value     = "";

  function selectItem(item) {
    if (disabled) return;

    value = getValue(item);
    onSelect(item, value);
  }
</script>

<aside class="target-list" aria-label={title}>
  <div class="target-list-title">{title}</div>

  <div class="target-list-items">
    {#if items.length === 0}
      <div class="target-list-empty">{emptyText}</div>
    {/if}

    {#each items as item}
      {@const itemValue = getValue(item)}
      <button
        type="button"
        class:active={value === itemValue}
        disabled={disabled}
        on:click={() => selectItem(item)}
      >
        {getLabel(item)}
      </button>
    {/each}
  </div>
</aside>

<style>
  .target-list {
    display: grid;
    align-content: start;
    gap: 8px;
    min-width: 0;
    padding: 12px;
    background: #f8fafc;
    border: 1px solid #eef1f5;
    border-radius: 8px;
  }

  .target-list-title {
    color: #4e5968;
    font-size: 12px;
    font-weight: 900;
  }

  .target-list-items {
    display: grid;
    gap: 6px;
    max-height: 260px;
    overflow: auto;
  }

  .target-list button {
    justify-content: flex-start;
    width: 100%;
    min-height: 36px;
    padding: 8px 10px;
    color: #172033;
    text-align: left;
    background: #ffffff;
    border: 1px solid #e5e8eb;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.35;
    white-space: normal;
  }

  .target-list button:hover,
  .target-list button.active {
    color: #1b64da;
    background: #eaf3ff;
    border-color: #9ac7ff;
  }

  .target-list-empty {
    padding: 12px;
    color: #667084;
    background: #ffffff;
    border: 1px dashed #dbe2ea;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 800;
    text-align: center;
  }
</style>
