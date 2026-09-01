"use client";

import { useEffect, useMemo, useState } from "react";

type MicsRow = {
  contentTitle: string;
  region: string;
  survey: string;
  countryName: string;
  round: string;
  question: string;
  include: 0 | 1;
};

type Payload = { source: string; rows: MicsRow[] };
type ViewName = "overview" | "country";
type ComparisonMode = "All surveys in the same round" | "All surveys in the same region" | "Median of the country" | "Median of region" | "Median of MICS countries";

const ROUND_ORDER = ["MICS 6", "MICS 5", "MICS 4", "MICS 3", "MICS 2"];
const ROUND_LABELS: Record<string, string> = {
  "MICS 6": "MICS 6 (2017–2023)",
  "MICS 5": "MICS 5 (2012–2017)",
  "MICS 4": "MICS 4 (2009–2013)",
  "MICS 3": "MICS 3 (2005–2010)",
  "MICS 2": "MICS 2 (1999–2003)",
};
const ALL_REGIONS = "All regions";
const ALL_COUNTRIES = "All countries";
const ALL_SURVEYS = "All surveys";
const COMPARISON_OPTIONS: ComparisonMode[] = ["All surveys in the same round", "All surveys in the same region", "Median of the country", "Median of region", "Median of MICS countries"];
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
  if (/household questionnaire/i.test(value)) return "Household Questionnaire";
  if (/women'?s questionnaire/i.test(value)) return "Women Questionnaire";
  if (/men'?s questionnaire/i.test(value)) return "Men Questionnaire";
  if (/under[- ]?5 questionnaire/i.test(value)) return "Under-5 Questionnaire";
  if (/5[- ]?17 questionnaire/i.test(value)) return "5-17 Questionnaire";
  return value.replace(/^Contents of /i, "").trim().replace(/^./, (character) => character.toUpperCase());
}

function formatTopicLabel(value: string) {
  return value.replace(/^Education\[/i, "Education [");
}

function SelectControl({ label, value, values, onChange, ariaLabel, disabled = false, displayLabels }: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  displayLabels?: Record<string, string>;
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select aria-label={ariaLabel ?? label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => <option key={item} value={item}>{displayLabels?.[item] ?? item}</option>)}
      </select>
    </label>
  );
}

function MetricCard({ label, value, tone = "gray", note, children, className = "" }: {
  label: string;
  value: string | number;
  tone?: "gray" | "cyan" | "navy" | "pale";
  note?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`metric-card metric-${tone}${className ? ` ${className}` : ""}`}>
      <h3>{label}</h3>
      <strong>{value}</strong>
      {note && <p>{note}</p>}
      {children}
    </article>
  );
}

function PhotoPanel({ country = false }: { country?: boolean }) {
  return <div className={`feature-photo${country ? " country-photo" : ""}`} role="img" aria-label="Children playing beneath a blue canopy" />;
}

function DataTooltip({ text, children, block = false }: { text: string; children: React.ReactNode; block?: boolean }) {
  return (
    <span className={`has-tooltip${block ? " tooltip-block" : ""}`} tabIndex={0} data-tooltip={text} aria-label={text}>
      {children}
    </span>
  );
}

function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="info-button" type="button" aria-label={label} title={label} onClick={onClick}>i</button>;
}

function InfoModal({ id, title, onClose, children }: { id: string; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="info-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="info-modal" role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="info-modal-header">
          <div><span>Dashboard guide</span><h2 id={id}>{title}</h2></div>
          <button className="info-modal-close" type="button" onClick={onClose} aria-label="Close dashboard guide">×</button>
        </header>
        <div className="info-modal-content">{children}</div>
      </section>
    </div>
  );
}

function OverviewView({ rows, round, setRound }: { rows: MicsRow[]; round: string; setRound: (round: string) => void }) {
  const filtered = useMemo(() => rows.filter((row) => row.round === round), [rows, round]);
  const contentTitles = useMemo(() => unique(filtered.map((row) => row.contentTitle)), [filtered]);
  const [questionnaire, setQuestionnaire] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const selectedQuestionnaire = contentTitles.includes(questionnaire)
    ? questionnaire
    : contentTitles.find((title) => /household/i.test(title)) ?? contentTitles[0] ?? "";
  const questionnaireLabels = useMemo(
    () => Object.fromEntries(contentTitles.map((title) => [title, shortContentTitle(title)])),
    [contentTitles],
  );

  const metrics = useMemo(() => {
    const topics = unique(filtered.map((row) => row.question)).length;
    const countries = unique(filtered.map((row) => row.countryName));
    const surveys = unique(filtered.map((row) => row.survey));
    const surveyStatistics = surveys.map((surveyName) => {
      const surveyRows = filtered.filter((row) => row.survey === surveyName);
      return unique(surveyRows.filter((row) => row.include === 1).map((row) => row.question)).length;
    }).filter((included) => included > 0);
    const totalIncluded = surveyStatistics.reduce((sum, included) => sum + included, 0);
    return {
      topics,
      countries: countries.length,
      surveys: surveys.length,
      averageIncluded: surveyStatistics.length ? Math.round(totalIncluded / surveyStatistics.length) : 0,
      minimumIncluded: surveyStatistics.length ? Math.min(...surveyStatistics) : 0,
      maximumIncluded: surveyStatistics.length ? Math.max(...surveyStatistics) : 0,
    };
  }, [filtered]);

  const questionCoverage = useMemo(() => {
    const source = filtered.filter((row) => row.contentTitle === selectedQuestionnaire);
    const surveys = unique(filtered.map((row) => row.survey));
    return unique(source.map((row) => row.question)).map((question) => {
      const questionRows = source.filter((row) => row.question === question);
      const included = surveys.filter((surveyName) => questionRows.some((row) => row.survey === surveyName && row.include === 1)).length;
      return { question, included, total: surveys.length, coverage: percent(included, surveys.length) };
    });
  }, [filtered, selectedQuestionnaire]);

  return (
    <section aria-labelledby="overview-title">
      <div className="view-heading">
        <div className="title-with-info">
          <h1 id="overview-title">Overall</h1>
          <InfoButton label="Open guide to Overview calculations" onClick={() => setShowInfo(true)} />
        </div>
        <SelectControl label="Content from" value={round} values={ROUND_ORDER} onChange={setRound} ariaLabel="MICS round" displayLabels={ROUND_LABELS} />
      </div>

      {showInfo && <InfoModal id="overview-guide-title" title="How the Overview is calculated" onClose={() => setShowInfo(false)}>
        <p className="methodology-intro">All values use surveys from the MICS round selected under <strong>Content from</strong>. A topic/module is included in a calculation when it is included in the survey.</p>
        <div className="methodology-grid">
          <section className="methodology-card"><h3>Headline metrics</h3><ul>
            <li><strong>Participating countries in this round:</strong> the number of countries with at least one survey in the selected round. A country is counted once even when it implemented multiple national, subnational or subpopulation surveys.</li>
            <li><strong>Number of surveys in this round:</strong> all surveys in the selected round, irrespective of national representation. A country may contribute more than one survey.</li>
            <li><strong>Total topics/modules in this round:</strong> the number of individual topics/modules offered in the selected round.</li>
          </ul></section>
          <section className="methodology-card"><h3>Selection of topics/modules</h3>
            <p>For each survey, the dashboard counts the distinct topics/modules included. The three cards summarize those survey-level counts.</p>
            <div className="formula-box"><strong>Total included topics/modules across surveys</strong><span>÷</span><strong>Number of surveys</strong></div>
            <p>The mean is rounded to the nearest whole topic/module. The minimum and maximum are the smallest and largest survey questionnaire counts. All-zero placeholder records are excluded from these three statistics.</p>
          </section>
          <section className="methodology-card methodology-wide"><h3>Topics/modules included across surveys</h3><p>For the selected questionnaire, each bar shows the percentage of surveys in the round that included the individual topic/module. The numerator is the number of surveys including it; the denominator is the total number of surveys in the round. Hover or focus a bar for the exact values.</p></section>
        </div>
      </InfoModal>}

      <div className="overview-top-grid">
        <div className="overview-primary-grid">
          <MetricCard label="Participating countries in this round" value={metrics.countries} tone="pale" />
          <MetricCard label="Number of surveys in this round" value={metrics.surveys} tone="gray" />
          <MetricCard label="Total topics/modules in this round" value={metrics.topics} />
          <PhotoPanel />
        </div>

        <section className="summary-statistics" aria-labelledby="percentage-summary-title">
          <h2 id="percentage-summary-title">Selection of topics/modules</h2>
          <p>Distribution across surveys in the selected round.</p>
          <div className="coverage-stat-grid overview-coverage-stat-grid">
            <MetricCard label="Mean number of topics/modules included across all surveys in this round" value={metrics.averageIncluded} tone="navy" note={`On average, ${metrics.averageIncluded} of ${metrics.topics} topics/modules were included per survey`} />
            <MetricCard label="Minimum" value={metrics.minimumIncluded} note={`The smallest survey questionnaire included ${metrics.minimumIncluded} of ${metrics.topics} topics/modules`} />
            <MetricCard label="Maximum" value={metrics.maximumIncluded} tone="cyan" note={`The largest survey questionnaire included ${metrics.maximumIncluded} of ${metrics.topics} topics/modules`} />
          </div>
        </section>
      </div>

      <section className="dashboard-section question-section">
        <div className="section-title-row">
          <h2>Topics/modules included across surveys</h2>
          <SelectControl label="" value={selectedQuestionnaire} values={contentTitles} onChange={setQuestionnaire} ariaLabel="Questionnaire" displayLabels={questionnaireLabels} />
        </div>
        <p className="section-note">Share of surveys that included each individual topic/module, by questionnaire.</p>
        <div className="bar-list">
          {questionCoverage.map((item) => (
            <div className="bar-row" key={item.question}>
              <span>{formatTopicLabel(item.question)}</span>
              <DataTooltip block text={`${item.question}: ${item.included} of ${item.total} surveys (${item.coverage}%) included this topic/module`}>
                <div className="bar-track"><i style={{ width: `${item.coverage}%` }} /></div>
              </DataTooltip>
            </div>
          ))}
        </div>
        <p className="chart-caption">Percentage of surveys including each topic/module in the selected round, by questionnaire</p>
      </section>
    </section>
  );
}

function CountryView({ rows, round, setRound }: { rows: MicsRow[]; round: string; setRound: (round: string) => void }) {
  const regions = useMemo(() => unique(rows.filter((row) => row.round === round).map((row) => row.region)).sort(), [rows, round]);
  const regionOptions = useMemo(() => [ALL_REGIONS, ...regions], [regions]);
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [survey, setSurvey] = useState("");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("All surveys in the same region");
  const [showInfo, setShowInfo] = useState(false);
  const selectedRegion = region === ALL_REGIONS || regions.includes(region)
    ? region
    : rows.find((row) => row.round === round && row.countryName === "Thailand")?.region ?? regions[0] ?? "";
  const regionRows = useMemo(() => rows.filter((row) => row.round === round && (selectedRegion === ALL_REGIONS || row.region === selectedRegion)), [rows, round, selectedRegion]);
  const countryNames = useMemo(() => unique(regionRows.map((row) => row.countryName)).sort(), [regionRows]);
  const countries = useMemo(() => [ALL_COUNTRIES, ...countryNames], [countryNames]);
  const selectedCountry = country === ALL_COUNTRIES || countryNames.includes(country) ? country : countryNames.find((item) => item === "Thailand") ?? countryNames[0] ?? ALL_COUNTRIES;
  const countryRows = useMemo(() => regionRows.filter((row) => selectedCountry === ALL_COUNTRIES || row.countryName === selectedCountry), [regionRows, selectedCountry]);
  const surveyNames = useMemo(() => unique(countryRows.map((row) => row.survey)).sort(), [countryRows]);
  const surveys = useMemo(() => [ALL_SURVEYS, ...surveyNames], [surveyNames]);
  const selectedSurvey = survey === ALL_SURVEYS || surveyNames.includes(survey) ? survey : surveyNames.find((item) => countryKey(item) === "thailand") ?? surveyNames[0] ?? ALL_SURVEYS;
  const surveyTableRows = selectedSurvey === ALL_SURVEYS ? surveyNames : [selectedSurvey];
  const currentRows = useMemo(() => countryRows.filter((row) => selectedSurvey === ALL_SURVEYS || row.survey === selectedSurvey), [countryRows, selectedSurvey]);
  const restrictComparisonToAllMics = selectedRegion === ALL_REGIONS || (selectedCountry === ALL_COUNTRIES && selectedSurvey === ALL_SURVEYS);
  const comparisonOptions = useMemo<ComparisonMode[]>(() => restrictComparisonToAllMics ? ["All surveys in the same round"] : COMPARISON_OPTIONS, [restrictComparisonToAllMics]);
  const selectedComparisonMode: ComparisonMode = comparisonOptions.includes(comparisonMode) ? comparisonMode : "All surveys in the same round";
  const selectedSeriesLabel = selectedSurvey !== ALL_SURVEYS
    ? selectedSurvey
    : selectedCountry !== ALL_COUNTRIES
      ? `${selectedCountry} — all surveys`
      : selectedRegion !== ALL_REGIONS
        ? `${selectedRegion} — all surveys`
        : `${round} — all surveys`;
  const contentTitles = useMemo(() => unique(currentRows.map((row) => row.contentTitle)), [currentRows]);
  const metrics = useMemo(() => {
    const total = unique(currentRows.map((row) => row.question)).length;
    const included = unique(currentRows.filter((row) => row.include === 1).map((row) => row.question)).length;
    return { total, included, coverage: percent(included, total), surveyCount: surveyNames.length };
  }, [currentRows, surveyNames]);

  const coverageSummary = useMemo(() => {
    const surveyStatistics = surveyNames.map((surveyName) => {
      const surveyRows = countryRows.filter((row) => row.survey === surveyName);
      const total = unique(surveyRows.map((row) => row.question)).length;
      const included = unique(surveyRows.filter((row) => row.include === 1).map((row) => row.question)).length;
      return { included, total, percentage: percent(included, total) };
    }).filter((item) => item.total > 0);
    const percentages = surveyStatistics.map((item) => item.percentage);
    const includedCounts = surveyStatistics.map((item) => item.included);
    return {
      minimumPercentage: percentages.length ? Math.min(...percentages) : 0,
      maximumPercentage: percentages.length ? Math.max(...percentages) : 0,
      medianPercentage: median(percentages),
      minimumIncluded: includedCounts.length ? Math.min(...includedCounts) : 0,
      maximumIncluded: includedCounts.length ? Math.max(...includedCounts) : 0,
      medianIncluded: median(includedCounts),
    };
  }, [countryRows, surveyNames]);

  const topicCoverage = useMemo(() => {
    const roundRows = rows.filter((row) => row.round === round);
    const roundRegionRows = roundRows.filter((row) => selectedRegion === ALL_REGIONS || row.region === selectedRegion);
    const sameCountryRows = roundRows.filter((row) => selectedCountry === ALL_COUNTRIES ? row.region === selectedRegion : row.countryName === selectedCountry);
    const comparisonSource = selectedComparisonMode === "Median of the country"
      ? sameCountryRows
      : selectedComparisonMode === "All surveys in the same round" || selectedComparisonMode === "Median of MICS countries"
        ? roundRows
        : roundRegionRows;

    return contentTitles.map((contentTitle) => {
      const topicRows = currentRows.filter((row) => row.contentTitle === contentTitle);
      const total = unique(topicRows.map((row) => row.question)).length;
      const included = unique(topicRows.filter((row) => row.include === 1).map((row) => row.question)).length;
      const selectedCoverage = total ? percent(included, total) : null;
      const comparisonCountries = unique(comparisonSource.map((row) => row.survey));
      const countryValues = comparisonCountries.map((survey) => {
        const surveyRows = comparisonSource.filter((row) => row.survey === survey && row.contentTitle === contentTitle);
        const surveyTotal = unique(surveyRows.map((row) => row.question)).length;
        const surveyIncluded = unique(surveyRows.filter((row) => row.include === 1).map((row) => row.question)).length;
        return surveyTotal ? { country: survey, countryName: surveyRows[0]?.countryName ?? "", coverage: percent(surveyIncluded, surveyTotal) } : null;
      }).filter(Boolean) as { country: string; countryName: string; coverage: number }[];
      const isMedian = selectedComparisonMode === "Median of the country" || selectedComparisonMode === "Median of region" || selectedComparisonMode === "Median of MICS countries";
      const comparisonMarkers = isMedian
        ? [{ country: selectedComparisonMode, countryName: "", coverage: median(countryValues.map((item) => item.coverage)) }]
        : countryValues.filter((item) => selectedSurvey === ALL_SURVEYS || item.country !== selectedSurvey);
      const overlappingComparisons = selectedCoverage === null
        ? []
        : comparisonMarkers.filter((item) => item.coverage === selectedCoverage).map((item) => item.country);

      return { name: shortContentTitle(contentTitle), total, included, coverage: percent(included, total), selectedCoverage, comparisonMarkers, overlappingComparisons };
    });
  }, [contentTitles, currentRows, rows, round, selectedRegion, selectedCountry, selectedSurvey, selectedComparisonMode]);

  function downloadCsv() {
    const header = ["Content Title", "Region", "Survey", "Country Name", "MICS Round", "Topics/Modules", "Include"];
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [header, ...currentRows.map((row) => [row.contentTitle, row.region, row.survey, row.countryName, row.round, row.question, row.include])]
      .map((line) => line.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedSurvey.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${round.toLowerCase().replace(" ", "-")}-mics-content.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-labelledby="country-title">
      <div className="view-heading country-heading">
        <div className="title-with-info">
          <h1 id="country-title">{selectedSurvey !== ALL_SURVEYS ? selectedSurvey : selectedCountry || "Country"}</h1>
          <InfoButton label="Open guide to Country view calculations" onClick={() => setShowInfo(true)} />
        </div>
        <div className="filter-row">
          <SelectControl label="Region" value={selectedRegion} values={regionOptions} onChange={(value) => { setRegion(value); setCountry(""); setSurvey(""); }} />
          <SelectControl label="Country" value={selectedCountry} values={countries} onChange={(value) => { setCountry(value); setSurvey(""); }} />
          <SelectControl label="Survey" value={selectedSurvey} values={surveys} onChange={setSurvey} />
          <SelectControl label="Content from" value={round} values={ROUND_ORDER} onChange={setRound} ariaLabel="MICS round" displayLabels={ROUND_LABELS} />
          <button className="download-button" type="button" onClick={downloadCsv}>Download summary data</button>
        </div>
      </div>

      {showInfo && <InfoModal id="country-guide-title" title="How the Country view is calculated" onClose={() => setShowInfo(false)}>
        <p className="methodology-intro">The top filters apply in order: <strong>MICS round → region → country → survey</strong>. “All” keeps every matching record at that level. A topic/module is included when <strong>Include</strong> equals 1.</p>
        <div className="methodology-grid">
          <section className="methodology-card"><h3>Headline metrics</h3><ul>
            <li><strong>Total topics/modules:</strong> distinct topics/modules in the active selection.</li>
            <li><strong>Topics/Modules included:</strong> distinct active topics/modules with Include = 1.</li>
            <li><strong>Surveys in selection:</strong> distinct Survey values matching the round, region and country filters.</li>
          </ul></section>
          <section className="methodology-card"><h3>Selected percentage</h3>
            <div className="formula-box"><strong>Distinct included topics/modules</strong><span>÷</span><strong>Distinct topics/modules in selection</strong><span>× 100</span></div>
            <p>Minimum, maximum and median summarize the individual surveys available within the selected country or selection. Notes show absolute included counts.</p>
          </section>
          <section className="methodology-card methodology-wide"><h3>Topic/module comparison chart</h3><p>For each questionnaire content group, coverage is included topics/modules divided by all topics/modules in that group. The <strong>blue line</strong> is the active top-filter selection. Thin dark-gray lines are comparison surveys. Equal values intentionally overlap, and the tooltip lists overlapping surveys.</p></section>
          <section className="methodology-card methodology-wide"><h3>Compare with options</h3>
            <dl className="comparison-definitions">
              <div><dt>All surveys in the same round</dt><dd>One comparison line for every survey in the selected MICS round.</dd></div>
              <div><dt>All surveys in the same region</dt><dd>One line for every survey in the selected region, including other surveys from the selected country.</dd></div>
              <div><dt>Median of the country</dt><dd>One median line across all national and subnational surveys sharing the selected Country Name.</dd></div>
              <div><dt>Median of region</dt><dd>One median line calculated from individual survey percentages in the selected region.</dd></div>
              <div><dt>Median of MICS countries</dt><dd>One median line calculated from all individual survey percentages in the selected round.</dd></div>
            </dl>
          </section>
          <section className="methodology-card methodology-wide"><h3>Availability rules and survey table</h3><p>With <strong>All regions</strong>, comparison is fixed to all surveys in the same round. When both <strong>All countries</strong> and <strong>All surveys</strong> are selected, only that round-wide comparison is offered. The bottom table lists distinct surveys matching the top filters.</p></section>
        </div>
      </InfoModal>}

      <div className="country-top-grid">
        <div className="metric-grid country-primary-grid">
          <MetricCard label={`Total topics/modules in ${round}`} value={metrics.total} />
          <MetricCard label="Topics/Modules included in survey" value={metrics.included} tone="cyan" />
          <MetricCard label={selectedCountry === ALL_COUNTRIES ? "Surveys in selection" : "Surveys in selected country"} value={metrics.surveyCount} tone="navy" />
          <PhotoPanel country />
        </div>

        <section className="summary-statistics country-summary-statistics" aria-labelledby="country-percentage-summary-title">
          <h2 id="country-percentage-summary-title">Percent topics/modules included in survey</h2>
          <p>{selectedCountry === ALL_COUNTRIES ? "Distribution across surveys in the selected region." : "Distribution across surveys and subnational surveys in the selected country."}</p>
          <div className="coverage-stat-grid">
            <MetricCard label={selectedSurvey === ALL_SURVEYS ? "All selected surveys" : "Selected survey"} value={`${metrics.coverage}%`} tone="navy" note={`${metrics.included} of ${metrics.total} topics/modules included`} />
            <MetricCard label="Minimum" value={`${coverageSummary.minimumPercentage}%`} note={`${coverageSummary.minimumIncluded} topics/modules included`} />
            <MetricCard label="Maximum" value={`${coverageSummary.maximumPercentage}%`} tone="cyan" note={`${coverageSummary.maximumIncluded} topics/modules included`} />
            <MetricCard label="Median" value={`${coverageSummary.medianPercentage}%`} tone="navy" note={`${coverageSummary.medianIncluded} topics/modules included`} />
          </div>
        </section>
      </div>

      <section className="dashboard-section">
        <div className="section-title-row topic-title-row">
          <h2>Percent topics/modules included in survey</h2>
          <SelectControl label="Compare with" value={selectedComparisonMode} values={comparisonOptions} disabled={selectedRegion === ALL_REGIONS} onChange={(value) => setComparisonMode(value as ComparisonMode)} ariaLabel="Topic coverage comparison" />
        </div>
        <p className="section-note">The blue line shows the active survey, country, region or round selection. Dark-gray lines show the selected comparison group.</p>
        <div className="coverage-head country-coverage-head"><span>Topics/Modules</span><span>Percent topics/modules included in survey</span></div>
        <div className="coverage-table country-coverage">
          {topicCoverage.map((item) => (
            <div className="coverage-row" key={item.name}>
              <span className="row-label">{item.name}</span>
              <DataTooltip block text={`${item.name}: ${item.included} of ${item.total} topics/modules included (${item.coverage}%)`}>
                <div className="single-bar"><i style={{ width: `${item.coverage}%` }} /></div>
              </DataTooltip>
              <div className="country-comparison-range" aria-label={`${item.name} country comparison`}>
                {item.comparisonMarkers.map((marker, index) => (
                  <i
                    key={`${marker.country}-${index}`}
                    tabIndex={0}
                    aria-label={`${marker.country}: ${marker.coverage}%`}
                    data-tooltip={`${marker.country}: ${marker.coverage}%`}
                    className={`comparison-marker has-tooltip${selectedCountry !== ALL_COUNTRIES && marker.countryName === selectedCountry ? " same-country-comparison-marker" : ""}`}
                    style={{ left: `${clamp(marker.coverage)}%` }}
                  />
                ))}
                {item.selectedCoverage !== null && (
                  <i
                    tabIndex={0}
                    aria-label={`${selectedSeriesLabel}: ${item.selectedCoverage}%${item.overlappingComparisons.length ? `; overlapping comparison surveys: ${item.overlappingComparisons.join(", ")}` : ""}`}
                    data-tooltip={`${selectedSeriesLabel}: ${item.selectedCoverage}%${item.overlappingComparisons.length ? ` · Same value: ${item.overlappingComparisons.join(", ")}` : ""}`}
                    className={`selected-country-marker has-tooltip${item.overlappingComparisons.length ? " has-overlap" : ""} ${item.selectedCoverage >= 95 ? "at-right" : ""}`}
                    style={{ left: `${clamp(item.selectedCoverage)}%` }}
                  ><span>{item.selectedCoverage}%</span></i>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="legend country-legend comparison-legend">
          <span><i className="line-marker-key selected-country-key" />Active selection</span>
          <span><i className="line-marker-key comparison-country-key" />{selectedComparisonMode.startsWith("Median") ? "Comparison median" : "Comparison countries"}</span>
        </div>
      </section>

      <section className="dashboard-section survey-list-section" aria-labelledby="survey-list-title">
        <div className="survey-list-heading">
          <h2 id="survey-list-title">Surveys in current selection</h2>
          <span>{surveyTableRows.length} {surveyTableRows.length === 1 ? "survey" : "surveys"}</span>
        </div>
        <div className="survey-table-wrap">
          <table className="survey-table">
            <thead><tr><th scope="col">Survey</th></tr></thead>
            <tbody>
              {surveyTableRows.map((surveyName) => <tr key={surveyName}><td>{surveyName}</td></tr>)}
            </tbody>
          </table>
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
    fetch("data/mics-question-include.json")
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
