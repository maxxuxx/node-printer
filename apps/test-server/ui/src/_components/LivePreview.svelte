<script>
  export let columns;
  export let encodedReceipt;
  export let livePreview;
  export let methodText;
  export let paper;
  export let previewFontSize;
  export let t;

  let activeView = "receipt";
</script>

<aside class="receipt-preview-pane" aria-label={t("livePreview")}>
  <div class="preview-tabs" role="tablist" aria-label={t("livePreview")}>
    <button
      type="button"
      role="tab"
      class:active={activeView === "receipt"}
      aria-selected={activeView === "receipt"}
      on:click={() => activeView = "receipt"}
    >
      {t("receiptView")}
    </button>
    <button
      type="button"
      role="tab"
      class:active={activeView === "method"}
      aria-selected={activeView === "method"}
      on:click={() => activeView = "method"}
    >
      {t("methodView")}
    </button>
  </div>

  <div class="preview-content">
    {#if activeView === "receipt"}
      <div class="receipt-preview-scale">
        <div class="receipt-paper" style={`--receipt-line-width: ${columns}ch; --receipt-preview-font-size: ${previewFontSize}px;`}>
          <div class="receipt-paper-head">
            <span>{t("livePreview")}</span>
            <strong>{paper} {columns} {t("columnsUnit")}</strong>
          </div>
          <div class="receipt-preview-body">
            {#each livePreview as row}
              {#if typeof row === "string"}
                <div class="receipt-preview-line">{row || "\u00a0"}</div>
              {:else if row.type === "qr"}
                <div class="receipt-qr-block" aria-label={row.label}>
                  <div class="receipt-qr-grid" style={`--qr-size: ${row.size};`}>
                    {#each row.modules as dark}
                      <span class="receipt-qr-cell" class:dark></span>
                    {/each}
                  </div>
                  <div class="receipt-preview-caption">{row.data}</div>
                </div>
              {:else if row.type === "barcode"}
                <div class="receipt-barcode-block" aria-label={row.label}>
                  <div class="receipt-barcode-grid" style={`--barcode-size: ${row.modules.length}; --barcode-width: ${row.width}px; --barcode-height: ${row.height}px;`}>
                    {#each row.modules as dark}
                      <span class="receipt-barcode-cell" class:dark={dark}></span>
                    {/each}
                  </div>
                  <div class="receipt-preview-caption">{row.data}</div>
                </div>
              {:else if row.type === "image"}
                <div class="receipt-image-block" aria-label={row.label}>
                  <div class="receipt-image-grid" style={`--image-size: ${row.width}; --image-width: ${row.size}px;`}>
                    {#each row.data as dark}
                      <span class="receipt-image-cell" class:dark={dark === 1}></span>
                    {/each}
                  </div>
                  <div class="receipt-preview-caption">{row.name}</div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>

      <details class="encoded-details wide-field">
        <summary>{t("encodedBytes")}</summary>
        <div class="encoded-grid">
          <label class="field">
            <span>{t("hex")}</span>
            <textarea value={encodedReceipt?.hex ?? ""} rows="5" readonly spellcheck="false"></textarea>
          </label>

          <label class="field">
            <span>{t("bytes")}</span>
            <textarea value={Array.isArray(encodedReceipt?.bytes) ? encodedReceipt.bytes.join(", ") : ""} rows="5" readonly spellcheck="false"></textarea>
          </label>
        </div>
      </details>
    {:else}
      <div class="live-method">
        <div class="receipt-paper-head">
          <span>{t("liveMethod")}</span>
          <strong>{paper} {columns} {t("columnsUnit")}</strong>
        </div>
        <pre>{methodText}</pre>
      </div>
    {/if}
  </div>
</aside>

<style>
  .receipt-preview-pane {
    position: sticky;
    top: 76px;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 12px;
    min-width: 0;
    max-height: calc(100vh - 156px);
    overflow: hidden;
    padding: 16px;
    background: #f8fafc;
    border-left: 1px solid #eef1f5;
  }

  .preview-content {
    display: grid;
    gap: 12px;
    min-height: 0;
    overflow: auto;
    scrollbar-width: none;
  }

  .preview-content::-webkit-scrollbar {
    display: none;
  }

  .preview-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    padding: 4px;
    background: #eef3f8;
    border-radius: 8px;
  }

  .preview-tabs button {
    min-height: 34px;
    color: #4e5968;
    background: transparent;
    border-radius: 6px;
  }

  .preview-tabs button:hover,
  .preview-tabs button.active {
    color: #1b64da;
    background: #ffffff;
  }

  .receipt-preview-scale {
    display: flex;
    justify-content: center;
    width: 100%;
    overflow-x: hidden;
  }

  .receipt-paper {
    flex: 0 0 auto;
    width: calc(var(--receipt-line-width) + 34px);
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e5e8eb;
    border-radius: 2px 2px 10px 10px;
    box-shadow: 0 14px 30px rgb(15 23 42 / 0.10);
    font-family: Consolas, "Courier New", monospace;
    font-size: var(--receipt-preview-font-size, 12px);
  }

  .receipt-paper-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 38px;
    padding: 0 12px;
    color: var(--muted);
    background: #f7f9fb;
    border-bottom: 1px solid #e5e8eb;
    font-family: Pretendard, Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    font-size: 12px;
    font-weight: 800;
  }

  .receipt-paper-head strong {
    color: var(--text);
    white-space: nowrap;
  }

  .receipt-preview-body {
    min-height: 460px;
    margin: 0;
    padding: 16px 16px 22px;
    color: #141922;
    line-height: 1.45;
    overflow: hidden auto;
    white-space: pre;
    word-break: normal;
  }

  .receipt-preview-line {
    width: var(--receipt-line-width);
    min-height: calc(var(--receipt-preview-font-size, 12px) * 1.45);
    white-space: pre;
  }

  .receipt-qr-block,
  .receipt-barcode-block,
  .receipt-image-block {
    display: grid;
    justify-items: center;
    gap: 6px;
    margin: 6px 0;
  }

  .receipt-qr-grid {
    display: grid;
    grid-template-columns: repeat(var(--qr-size), 1fr);
    width: min(150px, 72%);
    aspect-ratio: 1;
    padding: 8px;
    background: #ffffff;
    border: 1px solid #e5e8eb;
  }

  .receipt-qr-cell,
  .receipt-barcode-cell,
  .receipt-image-cell {
    background: #ffffff;
  }

  .receipt-qr-cell,
  .receipt-image-cell {
    aspect-ratio: 1;
  }

  .receipt-qr-cell.dark,
  .receipt-barcode-cell.dark,
  .receipt-image-cell.dark {
    background: #111827;
  }

  .receipt-barcode-grid {
    display: grid;
    grid-template-columns: repeat(var(--barcode-size), 1fr);
    align-items: stretch;
    width: min(var(--barcode-width), 92%);
    height: var(--barcode-height);
    max-height: 120px;
    background: #ffffff;
  }

  .receipt-barcode-cell {
    min-width: 1px;
  }

  .receipt-image-grid {
    display: grid;
    grid-template-columns: repeat(var(--image-size), 1fr);
    width: min(var(--image-width), 82%);
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e5e8eb;
    image-rendering: pixelated;
  }

  .receipt-preview-caption {
    max-width: 100%;
    color: #4e5968;
    font-family: Consolas, "Courier New", monospace;
    font-size: 10px;
    line-height: 1.35;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .encoded-details {
    width: 100%;
  }

  .live-method {
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e5e8eb;
    border-radius: 10px;
  }

  .live-method pre {
    max-height: 620px;
    margin: 0;
    padding: 16px;
    overflow: visible;
    color: #141922;
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
    line-height: 1.55;
    white-space: pre;
  }

  @media (max-width: 1160px) {
    .receipt-preview-pane {
      position: static;
      max-height: none;
      border-top: 1px solid var(--line);
      border-left: 0;
    }
  }

  @media (max-width: 720px) {
    .receipt-preview-body {
      min-height: 340px;
    }
  }
</style>
