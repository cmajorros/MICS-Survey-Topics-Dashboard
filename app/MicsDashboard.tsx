"use client";

import { useEffect, useMemo, useState } from "react";

type MicsRow = {
  contentTitle: string;
  region: string;
  survey: string;
  round: string;
  question: string;
  include: 0 | 1;
};

type Payload = { source: string; rows: MicsRow[] };
type ViewName = "overview" | "country";
type ComparisonMode = "All MICS countries" | "All countries in the same region" | "Median of region" | "Median of MICS countries";

const ROUND_ORDER = ["MICS 6", "MICS 5", "MICS 4", "MICS 3", "MICS 2"];
const ALL_COUNTRIES = "All countries";
const COMPARISON_OPTIONS: ComparisonMode[] = ["All MICS countries", "All countries in the same region", "Median of region", "Median of MICS countries"];
const BLUE = "#22a9d6";

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function countryKey(value: string) {
  return value.toLowerCase().replace(/\s*\[\d{4}\]\s*/g, " ").replace(/\s+/g, " ").trim();
}

function shortContentTitle(value: string) {
  return value
    .replace(/^Contents of /i, "")
    .replace(/ questionnaire$/i, "")
    .replace(/^the /i, "")
    .replace(/under[- ]five/i, "Children under five")
    .replace(/women'?s/i, "Women")
    .replace(/men'?s/i, "Men")
    .replace(/household/i, "Household")
    .replace(/questionnaire/i, "")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function SelectControl({ label, value, values, onChange, ariaLabel }: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select aria-label={ariaLabel ?? label} value={value} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function MetricCard({ label, value, tone = "gray", note, children }: {
  label: string;
  value: string | number;
  tone?: "gray" | "cyan" | "navy" | "pale";
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <h3>{label}</h3>
      <strong>{value}</strong>
      {note && <p>{note}</p>}
      {children}
    </article>
  );
}

function PhotoPanel({ country = false }: { country?: boolean }) {
  return <div className={`feature-photo${country ? " country-photo" : ""}`} role="img" aria-label={country ? "MICS field team preparing survey equipment" : "Children playing beneath a blue canopy"} />;
}

function DataTooltip({ text, children, block = false }: { text: string; children: React.ReactNode; block?: boolean }) {
  return (
    <span className={`has-tooltip${block ? " tooltip-block" : ""}`} tabIndex={0} data-tooltip={text} aria-label={text}>
      {children}
    </span>
  );
}

function OverviewView({ rows, round, setRound }: { rows: MicsRow[]; round: string; setRound: (round: string) => void }) {
  const filtered = useMemo(() => rows.filter((row) => row.round === round), [rows, round]);
  const contentTitles = useMemo(() => unique(filtered.map((row) => row.contentTitle)), [filtered]);
  const [questionnaire, setQuestionnaire] = useState("");
  const selectedQuestionnaire = contentTitles.includes(questionnaire)
    ? questionnaire
    : contentTitles.find((title) => /household/i.test(title)) ?? contentTitles[0] ?? "";

  const metrics = useMemo(() => {
    const topics = unique(filtered.map((row) => row.question)).length;
    const bySurvey = new Map<string, Set<string>>();
    filtered.filter((row) => row.include === 1).forEach((row) => {
      if (!bySurvey.has(row.survey)) bySurvey.set(row.survey, new Set());
      bySurvey.get(row.survey)?.add(row.question);
    });
    return {
      topics,
      medianIncluded: median([...bySurvey.values()].map((questions) => questions.size)),
      coverage: percent(filtered.filter((row) => row.include === 1).length, filtered.length),
      countries: unique(filtered.map((row) => row.survey)).length,
    };
  }, [filtered]);

  const coverageRows = useMemo(() => {
    const preferred = [
      /list of household members/i,
      /^education/i,
      /water and sanitation/i,
      /child (discipline|protection)/i,
      /^health/i,
    ];
    const questions = unique(filtered.map((row) => row.question));
    const selected = preferred.map((pattern) => questions.find((question) => pattern.test(question))).filter(Boolean) as string[];
    questions.forEach((question) => { if (selected.length < 5 && !selected.includes(question)) selected.push(question); });
    return selected.slice(0, 5).map((question) => {
      const questionRows = filtered.filter((row) => row.question === question);
      const regionalRates = unique(questionRows.map((row) => row.region)).map((region) => {
        const regionRows = questionRows.filter((row) => row.region === region);
        const regionCountries = unique(regionRows.map((row) => row.survey));
        const includedCountries = regionCountries.filter((survey) => regionRows.some((row) => row.survey === survey && row.include === 1));
        return percent(includedCountries.length, regionCountries.length);
      });
      const countries = unique(questionRows.map((row) => row.survey));
      const includedCountries = countries.filter((survey) => questionRows.some((row) => row.survey === survey && row.include === 1));
      return {
        question,
        totalCountries: countries.length,
        includedCountries: includedCountries.length,
        countryCoverage: percent(includedCountries.length, countries.length),
        min: Math.min(...regionalRates),
        median: median(regionalRates),
        max: Math.max(...regionalRates),
      };
    });
  }, [filtered]);

  const questionCoverage = useMemo(() => {
    const source = filtered.filter((row) => row.contentTitle === selectedQuestionnaire);
    return unique(source.map((row) => row.question)).slice(0, 10).map((question) => {
      const questionRows = source.filter((row) => row.question === question);
      const included = questionRows.filter((row) => row.include === 1).length;
      return { question, included, total: questionRows.length, coverage: percent(included, questionRows.length) };
    });
  }, [filtered, selectedQuestionnaire]);

  return (
    <section aria-labelledby="overview-title">
      <div className="view-heading">
        <h1 id="overview-title">Overall</h1>
        <SelectControl label="Content from" value={round} values={ROUND_ORDER} onChange={setRound} ariaLabel="MICS round" />
      </div>

      <div className="hero-grid">
        <div className="metric-grid">
          <MetricCard label="Topics" value={metrics.topics} />
          <MetricCard label="Median Topics Included on survey" value={metrics.medianIncluded} tone="cyan" />
          <MetricCard label="Coverage" value={`${metrics.coverage}%`} tone="navy" note="Topics included on survey / Total topics" />
          <MetricCard label="Total participated countries" value={metrics.countries} tone="pale" />
        </div>
        <PhotoPanel />
      </div>

      <section className="dashboard-section">
        <h2>Coverage by topic</h2>
        <p className="section-note">Regional minimum, median and maximum coverage. Hover or focus any mark for its exact value.</p>
        <div className="coverage-head"><span>Total countries</span><span>% coverage</span></div>
        <div className="coverage-table">
          {coverageRows.map((item) => {
            return <div className="coverage-row" key={item.question}>
              <span className="row-label">{item.question.replace("List of ", "")}</span>
              <DataTooltip block text={`${item.question}: ${item.includedCountries} of ${item.totalCountries} countries include this topic (${item.countryCoverage}%)`}>
                <div className="total-bar-group">
                  <div className="range-bar country-count-bar">
                    <i className="country-included" style={{ width: `${item.countryCoverage}%` }} />
                  </div>
                  <div className="total-bar-labels">
                    <span>{item.includedCountries} included</span><span>{item.totalCountries} countries</span>
                  </div>
                </div>
              </DataTooltip>
              <div className="dot-range marker-range">
                <i tabIndex={0} aria-label={`Minimum coverage ${item.min}%`} data-tooltip={`Minimum coverage: ${item.min}%`} className={`coverage-marker marker-orange has-tooltip ${item.min >= 95 ? "at-right" : ""}`} style={{ left: `${clamp(item.min)}%` }}>{item.min !== item.median && item.min !== item.max && <span>{item.min}%</span>}</i>
                <i tabIndex={0} aria-label={`Median coverage ${item.median}%`} data-tooltip={`Median coverage: ${item.median}%`} className={`coverage-marker marker-gray has-tooltip ${item.median >= 95 ? "at-right" : ""}`} style={{ left: `${clamp(item.median)}%` }}>{item.median !== item.max && <span>{item.median}%</span>}</i>
                <i tabIndex={0} aria-label={`Maximum coverage ${item.max}%`} data-tooltip={`Maximum coverage: ${item.max}%`} className={`coverage-marker marker-blue has-tooltip ${item.max >= 95 ? "at-right" : ""}`} style={{ left: `${clamp(item.max)}%` }}><span>{item.max}%</span></i>
              </div>
            </div>;
          })}
        </div>
        <div className="legend coverage-marker-legend">
          <span><i className="line-marker-key marker-blue" />maximum</span>
          <span><i className="line-marker-key marker-gray" />median</span>
          <span><i className="line-marker-key marker-orange" />minimum</span>
        </div>
      </section>

      <section className="dashboard-section question-section">
        <div className="section-title-row">
          <h2>Questions coverage</h2>
          <SelectControl label="" value={selectedQuestionnaire} values={contentTitles} onChange={setQuestionnaire} ariaLabel="Questionnaire" />
        </div>
        <p className="section-note">Share of surveyed countries including each question.</p>
        <div className="bar-list">
          {questionCoverage.map((item) => (
            <div className="bar-row" key={item.question}>
              <span>{item.question}</span>
              <DataTooltip block text={`${item.question}: ${item.included} of ${item.total} surveyed countries (${item.coverage}%) include this question`}>
                <div className="bar-track"><i style={{ width: `${item.coverage}%` }} /></div>
              </DataTooltip>
              <b>{item.coverage}% <small>{item.included}/{item.total}</small></b>
            </div>
          ))}
        </div>
        <p className="chart-caption">% of surveyed countries that include the question in the selected questionnaire</p>
      </section>
    </section>
  );
}

function CountryView({ rows, round, setRound }: { rows: MicsRow[]; round: string; setRound: (round: string) => void }) {
  const regions = useMemo(() => unique(rows.filter((row) => row.round === round).map((row) => row.region)).sort(), [rows, round]);
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [questionnaire, setQuestionnaire] = useState("");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("All countries in the same region");
  const selectedRegion = regions.includes(region)
    ? region
    : rows.find((row) => row.round === round && countryKey(row.survey) === "thailand")?.region ?? regions[0] ?? "";
  const countryNames = useMemo(() => unique(rows.filter((row) => row.round === round && row.region === selectedRegion).map((row) => row.survey)).sort(), [rows, round, selectedRegion]);
  const countries = useMemo(() => [ALL_COUNTRIES, ...countryNames], [countryNames]);
  const selectedCountry = country === ALL_COUNTRIES || countryNames.includes(country) ? country : countryNames.find((item) => countryKey(item) === "thailand") ?? countryNames[0] ?? ALL_COUNTRIES;
  const currentRows = useMemo(() => rows.filter((row) => row.round === round && (selectedCountry === ALL_COUNTRIES ? row.region === selectedRegion : row.survey === selectedCountry)), [rows, round, selectedCountry, selectedRegion]);
  const contentTitles = useMemo(() => unique(currentRows.map((row) => row.contentTitle)), [currentRows]);
  const selectedQuestionnaire = contentTitles.includes(questionnaire)
    ? questionnaire
    : contentTitles.find((title) => /household/i.test(title)) ?? contentTitles[0] ?? "";

  const metrics = useMemo(() => {
    const total = unique(currentRows.map((row) => row.question)).length;
    const included = unique(currentRows.filter((row) => row.include === 1).map((row) => row.question)).length;
    const currentRoundIndex = ROUND_ORDER.indexOf(round);
    const previousRound = ROUND_ORDER[currentRoundIndex + 1];
    const matchKey = countryKey(selectedCountry);
    const previousRows = rows.filter((row) => row.round === previousRound && (selectedCountry === ALL_COUNTRIES ? row.region === selectedRegion : countryKey(row.survey) === matchKey));
    const currentMap = new Map(currentRows.map((row) => [`${row.contentTitle}||${row.question}`, row.include]));
    const previousMap = new Map(previousRows.map((row) => [`${row.contentTitle}||${row.question}`, row.include]));
    const keys = unique([...currentMap.keys(), ...previousMap.keys()]);
    const added = keys.filter((key) => (currentMap.get(key) ?? 0) === 1 && (previousMap.get(key) ?? 0) === 0).length;
    const removed = keys.filter((key) => (currentMap.get(key) ?? 0) === 0 && (previousMap.get(key) ?? 0) === 1).length;
    return { total, included, coverage: percent(included, total), added, removed, previousRound };
  }, [selectedCountry, selectedRegion, currentRows, round, rows]);

  const topicCoverage = useMemo(() => {
    const roundRows = rows.filter((row) => row.round === round);
    const regionRows = roundRows.filter((row) => row.region === selectedRegion);
    const comparisonSource = comparisonMode === "All MICS countries" || comparisonMode === "Median of MICS countries" ? roundRows : regionRows;

    return contentTitles.slice(0, 5).map((contentTitle) => {
      const topicRows = currentRows.filter((row) => row.contentTitle === contentTitle);
      const total = unique(topicRows.map((row) => row.question)).length;
      const included = unique(topicRows.filter((row) => row.include === 1).map((row) => row.question)).length;
      const selectedCoverage = selectedCountry === ALL_COUNTRIES ? null : percent(included, total);
      const comparisonCountries = unique(comparisonSource.map((row) => row.survey));
      const countryValues = comparisonCountries.map((survey) => {
        const surveyRows = comparisonSource.filter((row) => row.survey === survey && row.contentTitle === contentTitle);
        const surveyTotal = unique(surveyRows.map((row) => row.question)).length;
        const surveyIncluded = unique(surveyRows.filter((row) => row.include === 1).map((row) => row.question)).length;
        return surveyTotal ? { country: survey, coverage: percent(surveyIncluded, surveyTotal) } : null;
      }).filter(Boolean) as { country: string; coverage: number }[];
      const isMedian = comparisonMode === "Median of region" || comparisonMode === "Median of MICS countries";
      const comparisonMarkers = isMedian
        ? [{ country: comparisonMode, coverage: median(countryValues.map((item) => item.coverage)) }]
        : countryValues.filter((item) => selectedCountry === ALL_COUNTRIES || item.country !== selectedCountry);

      return { name: shortContentTitle(contentTitle), total, included, coverage: percent(included, total), selectedCoverage, comparisonMarkers };
    });
  }, [contentTitles, currentRows, rows, round, selectedRegion, selectedCountry, comparisonMode]);

  const matrixQuestions = useMemo(() => unique(currentRows.filter((row) => row.contentTitle === selectedQuestionnaire).map((row) => row.question)).slice(0, 14), [currentRows, selectedQuestionnaire]);
  const matchKey = countryKey(selectedCountry);

  function downloadCsv() {
    const header = ["Content Title", "Region", "Survey", "MICS Round", "Question", "Include"];
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [header, ...currentRows.map((row) => [row.contentTitle, row.region, row.survey, row.round, row.question, row.include])]
      .map((line) => line.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedCountry.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${round.toLowerCase().replace(" ", "-")}-mics-content.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-labelledby="country-title">
      <div className="view-heading country-heading">
        <h1 id="country-title">{selectedCountry || "Country"}</h1>
        <div className="filter-row">
          <SelectControl label="Region" value={selectedRegion} values={regions} onChange={setRegion} />
          <SelectControl label="Country" value={selectedCountry} values={countries} onChange={setCountry} />
          <SelectControl label="Content from" value={round} values={ROUND_ORDER} onChange={setRound} ariaLabel="MICS round" />
          <button className="download-button" type="button" onClick={downloadCsv}>Download data</button>
        </div>
      </div>

      <div className="hero-grid">
        <div className="metric-grid">
          <MetricCard label="Questions" value={metrics.total} />
          <MetricCard label="Topics Included on survey" value={metrics.included} tone="cyan" />
          <MetricCard label="Coverage" value={`${metrics.coverage}%`} tone="navy" note="Topics included on survey / Total topics" />
          <MetricCard label="Change from previous round" value={`+${metrics.added}/-${metrics.removed}`} tone="pale">
            <div className="change-labels"><span>added</span><span>removed</span></div>
          </MetricCard>
        </div>
        <PhotoPanel country />
      </div>

      <section className="dashboard-section">
        <div className="section-title-row topic-title-row">
          <h2>Topic coverage</h2>
          <SelectControl label="Compare with" value={comparisonMode} values={COMPARISON_OPTIONS} onChange={(value) => setComparisonMode(value as ComparisonMode)} ariaLabel="Topic coverage comparison" />
        </div>
        <p className="section-note">The blue line shows the selected country. Dark-gray lines show the selected comparison group.</p>
        <div className="coverage-head country-coverage-head"><span>Topics</span><span>% coverage</span></div>
        <div className="coverage-table country-coverage">
          {topicCoverage.map((item) => (
            <div className="coverage-row" key={item.name}>
              <span className="row-label">{item.name}<small>{item.included} of {item.total} questions · {item.coverage}%</small></span>
              <DataTooltip block text={`${item.name}: ${item.included} of ${item.total} questions included (${item.coverage}%)`}>
                <div className="single-bar"><i style={{ width: `${item.coverage}%` }} /></div>
              </DataTooltip>
              <div className="country-comparison-range" aria-label={`${item.name} country comparison`}>
                {item.comparisonMarkers.map((marker, index) => (
                  <i
                    key={`${marker.country}-${index}`}
                    tabIndex={0}
                    aria-label={`${marker.country}: ${marker.coverage}%`}
                    data-tooltip={`${marker.country}: ${marker.coverage}%`}
                    className="comparison-marker has-tooltip"
                    style={{ left: `${clamp(marker.coverage)}%` }}
                  />
                ))}
                {item.selectedCoverage !== null && (
                  <i
                    tabIndex={0}
                    aria-label={`${selectedCountry}: ${item.selectedCoverage}%`}
                    data-tooltip={`${selectedCountry}: ${item.selectedCoverage}%`}
                    className={`selected-country-marker has-tooltip ${item.selectedCoverage >= 95 ? "at-right" : ""}`}
                    style={{ left: `${clamp(item.selectedCoverage)}%` }}
                  ><span>{item.selectedCoverage}%</span></i>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="legend country-legend comparison-legend">
          {selectedCountry !== ALL_COUNTRIES && <span><i className="line-marker-key selected-country-key" />Selected country</span>}
          <span><i className="line-marker-key comparison-country-key" />{comparisonMode.startsWith("Median") ? "Comparison median" : "Comparison countries"}</span>
        </div>
      </section>

      <section className="dashboard-section matrix-section">
        <div className="section-title-row">
          <h2>Question coverage</h2>
          <SelectControl label="" value={selectedQuestionnaire} values={contentTitles} onChange={setQuestionnaire} ariaLabel="Questionnaire" />
        </div>
        <p className="section-note">Each dot represents this question’s status in a MICS round. Hover or focus to read the value.</p>
        <div className="matrix-scroll" tabIndex={0} aria-label="Question coverage by MICS round">
          <div className="matrix-grid matrix-header">
            <b>Questions</b>
            <b className="round-heading">MICS Round</b>
            {ROUND_ORDER.map((item) => <span key={item}>{item.replace("MICS ", "")}</span>)}
          </div>
          {matrixQuestions.map((question) => (
            <div className="matrix-grid" key={question}>
              <span>{question}</span><i aria-hidden="true" />
              {ROUND_ORDER.map((item) => {
                const candidates = rows.filter((row) => row.round === item && countryKey(row.survey) === matchKey && row.contentTitle === selectedQuestionnaire && row.question === question);
                const value = candidates[0]?.include;
                const status = value === 1 ? "Included" : value === 0 ? "Not included" : "No record / Not conduct survey";
                return <i key={item} tabIndex={0} aria-label={`${question}, ${item}: ${status}`} data-tooltip={`${item}: ${status}`} className={`matrix-dot has-tooltip ${value === 1 ? "included" : value === 0 ? "removed" : "missing"}`} />;
              })}
            </div>
          ))}
        </div>
        <div className="legend matrix-legend">
          <span><i className="dot dot-blue" />Include</span>
          <span><i className="dot dot-orange" />Not included</span>
          <span><i className="dot dot-gray" />No record / Not conduct survey</span>
        </div>
      </section>
    </section>
  );
}

export function MicsDashboard() {
  const [rows, setRows] = useState<MicsRow[]>([]);
  const [view, setView] = useState<ViewName>("overview");
  const [round, setRound] = useState("MICS 6");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/data/mics-question-include.json")
      .then((response) => {
        if (!response.ok) throw new Error("The MICS dataset could not be loaded.");
        return response.json() as Promise<Payload>;
      })
      .then((payload) => setRows(payload.rows))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <main className="dashboard-shell">
      <nav className="view-tabs" aria-label="Dashboard views">
        <button className={view === "overview" ? "active" : ""} type="button" onClick={() => setView("overview")}>Overview</button>
        <button className={view === "country" ? "active" : ""} type="button" onClick={() => setView("country")}>Country view</button>
      </nav>
      {error && <div className="status-message error">{error}</div>}
      {!error && !rows.length && <div className="status-message">Loading MICS survey content…</div>}
      {!!rows.length && view === "overview" && <OverviewView rows={rows} round={round} setRound={setRound} />}
      {!!rows.length && view === "country" && <CountryView rows={rows} round={round} setRound={setRound} />}
      <footer>Source: UNICEF MICS Contents by Survey · MICS rounds 2–6</footer>
    </main>
  );
}
