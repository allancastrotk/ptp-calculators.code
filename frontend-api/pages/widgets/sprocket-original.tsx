import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorBanner } from "../../components/ErrorBanner";
import { InputField } from "../../components/InputField";
import { Layout } from "../../components/Layout";
import { ResultPanel } from "../../components/ResultPanel";
import { StatusPanel } from "../../components/StatusPanel";
import { SelectField } from "../../components/SelectField";
import { UnitSystem } from "../../components/UnitSystemSwitch";
import { UnitToggleButton } from "../../components/UnitToggleButton";
import { postJson, ApiError } from "../../lib/api";
import { postEmbedMessage } from "../../lib/embed";
import { useI18n } from "../../lib/i18n";

type SprocketResponse = {
  calculator: string;
  unit_system: "metric" | "imperial";
  normalized_inputs: {
    sprocket_teeth: number;
    crown_teeth: number;
    chain_pitch?: string | null;
    chain_links?: number | null;
  };
  results: {
    ratio: number;
    chain_length_mm?: number | null;
    chain_length_in?: number | null;
    center_distance_mm?: number | null;
    center_distance_in?: number | null;
  };
  warnings?: string[];
  meta: {
    version: string;
    timestamp: string;
    source: string;
  };
};

type ResultItem = {
  label: string;
  value: string;
};

type OriginalMessage = {
  type: "ptp:calc:sprocket:originalResult";
  pageId?: string;
  payload: SprocketResponse;
};

const CHAIN_PITCH_OPTIONS = [
  "415",
  "420",
  "428",
  "520",
  "525",
  "530",
  "630",
];

const RETRY_DELAYS_MS = [800, 1600, 2400];

const RETRY_STATUSES = new Set([
  502,
  503,
  504,
]);

const ALLOWED_PARENT_ORIGINS = new Set([
  "https://powertunepro.com",
  "https://www.powertunepro.com",
]);

function isRetriable(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  const status = (
    error as {
      status?: number;
    }
  ).status;

  return status
    ? RETRY_STATUSES.has(status)
    : false;
}

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

export default function SprocketOriginalWidget() {
  const { t } = useI18n();
  const router = useRouter();

  const pageId = useMemo(() => {
    const value = router.query.pageId;

    return (
      typeof value === "string" &&
      value.trim()
        ? value
        : undefined
    );
  }, [router.query.pageId]);

  const [unitSystem, setUnitSystem] =
    useState<UnitSystem>("metric");

  const [sprocket, setSprocket] =
    useState("");

  const [crown, setCrown] =
    useState("");

  const [pitch, setPitch] =
    useState("");

  const [links, setLinks] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [retryHint, setRetryHint] =
    useState<string | null>(null);

  const [
    warmupNotice,
    setWarmupNotice,
  ] = useState<string | null>(null);

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<Record<string, string>>(
    {}
  );

  const [result, setResult] =
    useState<SprocketResponse | null>(
      null
    );

  const abortRef =
    useRef<AbortController | null>(
      null
    );

  /*
   * Root real do conteúdo do widget.
   *
   * É este elemento que será medido,
   * nunca body/html/viewport do iframe.
   */
  const resizeRootRef =
    useRef<HTMLDivElement | null>(
      null
    );

  /*
   * Resize dinâmico do iframe.
   */
  useEffect(() => {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    /*
     * Se a página estiver aberta diretamente
     * e não dentro de um iframe, não há nada
     * para redimensionar.
     */
    if (window.parent === window) {
      return;
    }

    const root =
      resizeRootRef.current;

    if (!root) {
      return;
    }

    /*
     * Descobre qual domínio PowerTunePro
     * abriu o widget.
     */
    let parentOrigin =
      "https://powertunepro.com";

    try {
      if (document.referrer) {
        const referrerOrigin =
          new URL(
            document.referrer
          ).origin;

        if (
          ALLOWED_PARENT_ORIGINS.has(
            referrerOrigin
          )
        ) {
          parentOrigin =
            referrerOrigin;
        }
      }
    } catch {
      /*
       * Mantém o domínio padrão.
       */
    }

    let lastHeight = 0;
    let animationFrameId = 0;

    /*
     * Mede a posição real do fim do conteúdo
     * em relação ao topo do documento.
     *
     * Isso inclui eventual padding superior
     * aplicado pelo Layout, mas não depende
     * da altura atual do iframe.
     */
    const measureHeight = () => {
      const rect =
        root.getBoundingClientRect();

      return Math.ceil(
        rect.bottom +
          window.scrollY +
          2
      );
    };

    const sendHeight = (
      force = false
    ) => {
      animationFrameId = 0;

      const height =
        measureHeight();

      if (
        !Number.isFinite(height) ||
        height <= 0
      ) {
        return;
      }

      /*
       * Evita ciclos por diferenças
       * irrelevantes de 1px.
       */
      if (
        !force &&
        Math.abs(
          height - lastHeight
        ) < 2
      ) {
        return;
      }

      lastHeight = height;

      try {
        window.parent.postMessage(
          {
            type: "ptp:resize",
            pageId,
            height,
          },
          parentOrigin
        );
      } catch {
        /*
         * Resize nunca deve quebrar
         * a calculadora.
         */
      }
    };

    const scheduleHeight = (
      force = false
    ) => {
      /*
       * Força nova transmissão mesmo
       * que numericamente seja igual
       * à última medição.
       */
      if (force) {
        lastHeight = 0;
      }

      if (animationFrameId) {
        cancelAnimationFrame(
          animationFrameId
        );
      }

      animationFrameId =
        requestAnimationFrame(() => {
          sendHeight(force);
        });
    };

    /*
     * Principal mecanismo:
     * qualquer alteração real de tamanho
     * do widget dispara nova medição.
     */
    const resizeObserver =
      typeof ResizeObserver !==
      "undefined"
        ? new ResizeObserver(() => {
            scheduleHeight();
          })
        : null;

    resizeObserver?.observe(root);

    /*
     * Complementa ResizeObserver para
     * alterações de DOM:
     *
     * - resultado aparece;
     * - erro aparece;
     * - loading aparece/desaparece;
     * - textos mudam;
     * - idioma muda.
     */
    const mutationObserver =
      typeof MutationObserver !==
      "undefined"
        ? new MutationObserver(() => {
            scheduleHeight();
          })
        : null;

    mutationObserver?.observe(
      root,
      {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      }
    );

    /*
     * Permite ao WordPress pedir
     * explicitamente uma nova medição.
     */
    const handleParentMessage = (
      event: MessageEvent
    ) => {
      if (
        !ALLOWED_PARENT_ORIGINS.has(
          event.origin
        )
      ) {
        return;
      }

      const data = event.data;

      if (
        !data ||
        typeof data !== "object"
      ) {
        return;
      }

      if (
        data.type !==
        "ptp:requestResize"
      ) {
        return;
      }

      /*
       * Se ambos os lados tiverem pageId,
       * precisa ser a mesma página.
       */
      if (
        data.pageId &&
        pageId &&
        data.pageId !== pageId
      ) {
        return;
      }

      scheduleHeight(true);
    };

    window.addEventListener(
      "message",
      handleParentMessage
    );

    /*
     * Mudança de largura interna:
     * mobile/desktop/orientação.
     */
    const handleWindowResize =
      () => {
        scheduleHeight(true);
      };

    window.addEventListener(
      "resize",
      handleWindowResize
    );

    /*
     * Fontes podem alterar a geometria
     * após o primeiro render.
     */
    if (document.fonts?.ready) {
      document.fonts.ready.then(
        () => {
          scheduleHeight(true);
        }
      );
    }

    /*
     * Medições defensivas durante
     * a inicialização do React/widget.
     */
    const bootstrapDelays = [
      0,
      50,
      150,
      300,
      700,
      1500,
      3000,
    ];

    const timers =
      bootstrapDelays.map(
        (delay) =>
          window.setTimeout(
            () => {
              scheduleHeight(true);
            },
            delay
          )
      );

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(
          animationFrameId
        );
      }

      resizeObserver?.disconnect();
      mutationObserver?.disconnect();

      window.removeEventListener(
        "message",
        handleParentMessage
      );

      window.removeEventListener(
        "resize",
        handleWindowResize
      );

      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [pageId]);

  const lengthUnit =
    unitSystem === "imperial"
      ? "in"
      : "mm";

  const toNumber = (
    value: string
  ) =>
    Number(
      value.replace(",", ".")
    );

  const formatLength = (
    mmValue?: number | null,
    inValue?: number | null
  ) => {
    if (
      mmValue === undefined ||
      mmValue === null
    ) {
      return "-";
    }

    if (
      unitSystem === "imperial"
    ) {
      return `${
        (
          inValue ??
          mmValue / 25.4
        ).toFixed(2)
      } ${lengthUnit}`;
    }

    return `${mmValue.toFixed(
      2
    )} ${lengthUnit}`;
  };

  const postWithRetry = async (
    payload: unknown,
    signal: AbortSignal
  ) => {
    for (
      let attempt = 0;
      attempt <=
      RETRY_DELAYS_MS.length;
      attempt += 1
    ) {
      try {
        if (attempt > 0) {
          setWarmupNotice(
            t("warmupMessage")
          );
        }

        const response =
          await postJson<SprocketResponse>(
            "/api/v1/calc/sprocket",
            payload,
            signal
          );

        setWarmupNotice(null);

        return response;
      } catch (err) {
        if (
          (err as Error).name ===
          "AbortError"
        ) {
          throw err;
        }

        const retriable =
          isRetriable(err);

        if (
          !retriable ||
          attempt ===
            RETRY_DELAYS_MS.length
        ) {
          throw err;
        }

        await sleep(
          RETRY_DELAYS_MS[
            attempt
          ]
        );
      }
    }

    throw new Error(
      "Request failed"
    );
  };

  const handleSubmit =
    async () => {
      setError(null);
      setRetryHint(null);
      setWarmupNotice(null);
      setFieldErrors({});

      const nextErrors: Record<
        string,
        string
      > = {};

      if (!sprocket) {
        nextErrors.sprocket_teeth =
          t("required");
      }

      if (!crown) {
        nextErrors.crown_teeth =
          t("required");
      }

      if (
        Object.keys(
          nextErrors
        ).length > 0
      ) {
        setFieldErrors(
          nextErrors
        );

        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller =
        new AbortController();

      abortRef.current =
        controller;

      setLoading(true);

      try {
        const payload = {
          unit_system:
            unitSystem,

          inputs: {
            sprocket_teeth:
              toNumber(
                sprocket
              ),

            crown_teeth:
              toNumber(crown),

            chain_pitch:
              pitch ||
              undefined,

            chain_links:
              links
                ? toNumber(links)
                : undefined,
          },
        };

        const response =
          await postWithRetry(
            payload,
            controller.signal
          );

        setResult(response);

        const message: OriginalMessage =
          {
            type:
              "ptp:calc:sprocket:originalResult",

            pageId,

            payload:
              response,
          };

        postEmbedMessage(
          message
        );
      } catch (err) {
        if (
          (err as Error).name ===
          "AbortError"
        ) {
          return;
        }

        if (isRetriable(err)) {
          setRetryHint(
            t("retryHint")
          );
        }

        const apiError =
          err as ApiError;

        setError(
          apiError.message ||
            t("errorTitle")
        );

        if (
          apiError.field_errors
        ) {
          const mapped: Record<
            string,
            string
          > = {};

          apiError.field_errors.forEach(
            (
              fieldError
            ) => {
              const key =
                fieldError.field.replace(
                  "inputs.",
                  ""
                );

              mapped[key] =
                fieldError.reason;
            }
          );

          setFieldErrors(
            mapped
          );
        }
      } finally {
        setLoading(false);
      }
    };

  const resultsList =
    useMemo(
      (): ResultItem[] => {
        if (!result) {
          return [];
        }

        return [
          {
            label: t(
              "sprocketRatioLabel"
            ),

            value:
              result.results.ratio.toFixed(
                2
              ),
          },

          {
            label: t(
              "chainLengthLabel"
            ),

            value:
              formatLength(
                result.results
                  .chain_length_mm,

                result.results
                  .chain_length_in
              ),
          },

          {
            label: t(
              "centerDistanceLabel"
            ),

            value:
              formatLength(
                result.results
                  .center_distance_mm,

                result.results
                  .center_distance_in
              ),
          },
        ];
      },
      [
        result,
        t,
        unitSystem,
      ]
    );

  return (
    <Layout
      title={t("sprocket")}
      hideHeader
      hideFooter
      variant="pilot"
    >
      <div
        ref={resizeRootRef}
        data-ptp-resize-root
        className="ptp-stack"
        style={{
          height: "auto",
          minHeight: 0,
        }}
      >
        <Card className="ptp-stack">
          <div className="ptp-section-header">
            <div className="ptp-section-title">
              {t(
                "originalAssemblySection"
              )}
            </div>

            <UnitToggleButton
              value={unitSystem}
              onChange={
                setUnitSystem
              }
            />
          </div>

          {error ? (
            <ErrorBanner
              message={error}
            />
          ) : null}

          {retryHint ? (
            <div className="ptp-field__helper">
              {retryHint}
            </div>
          ) : null}

          <div className="grid">
            <InputField
              label={t(
                "sprocketLabel"
              )}
              hint={t(
                "hintSprocketTeeth"
              )}
              placeholder="14"
              value={sprocket}
              onChange={
                setSprocket
              }
              inputMode="numeric"
              error={
                fieldErrors.sprocket_teeth
              }
            />

            <InputField
              label={t(
                "crownLabel"
              )}
              hint={t(
                "hintCrownTeeth"
              )}
              placeholder="42"
              value={crown}
              onChange={
                setCrown
              }
              inputMode="numeric"
              error={
                fieldErrors.crown_teeth
              }
            />

            <SelectField
              label={t(
                "chainPitchLabel"
              )}
              hint={t(
                "hintChainPitch"
              )}
              placeholder={t(
                "selectPlaceholder"
              )}
              value={pitch}
              onChange={
                setPitch
              }
              options={CHAIN_PITCH_OPTIONS.map(
                (
                  option
                ) => ({
                  value:
                    option,

                  label:
                    option,
                })
              )}
              error={
                fieldErrors.chain_pitch
              }
            />

            <InputField
              label={t(
                "chainLinksLabel"
              )}
              hint={t(
                "hintChainLinks"
              )}
              placeholder="110"
              value={links}
              onChange={
                setLinks
              }
              inputMode="numeric"
              error={
                fieldErrors.chain_links
              }
            />
          </div>

          <div className="ptp-actions ptp-actions--spaced">
            <Button
              type="button"
              onClick={
                handleSubmit
              }
              disabled={
                loading
              }
            >
              {loading
                ? t(
                    "loading"
                  )
                : t(
                    "calculate"
                  )}
            </Button>
          </div>

          {loading ? (
            <StatusPanel
              message={t(
                "warmupMessage"
              )}
            />
          ) : null}

          {warmupNotice ? (
            <div className="ptp-card">
              {
                warmupNotice
              }
            </div>
          ) : null}

          {result ? (
            <ResultPanel
              title={t(
                "originalAssemblyResultsTitle"
              )}
              items={
                resultsList
              }
            />
          ) : null}
        </Card>
      </div>
    </Layout>
  );
}
