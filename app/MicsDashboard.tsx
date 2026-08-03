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
type ComparisonMode = "All surveys in the same round" | "All survey in the same regions" | "Median of the country" | "Median of region" | "Median of MICS countries";

const ROUND_ORDER = ["MICS 6", "MICS 5", "MICS 4", "MICS 3", "MICS 2"];
const ALL_REGIONS = "All regions";
const ALL_COUNTRIES = "All countries";
const ALL_SURVEYS = "All surveys";
const COMPARISON_OPTIONS: ComparisonMode[] = ["All surveys in the same round", "All survey in the same regions", "Median of the country", "Median of region", "Median of MICS countries"];
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

function SelectControl({ label, value, values, onChange, ariaLabel, disabled = false }: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select aria-label={ariaLabel ?? label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
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
  return <div className={`feature-photo${country ? " country-photo" : ""}`} role="img" aria-label={country ? "MICS field team preparing survey equipment" : "Children playing beneath a blue canopy"} />;
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

  const metrics = useMemo(() => {
    const topics = unique(filtered.map((row) => row.question)).length;
    const countryStatistics = unique(filtered.map((row) => row.countryName)).map((countryName) => {
      const countryRows = filtered.filter((row) => row.countryName === countryName);
      const includedTopics = unique(countryRows.filter((row) => row.include === 1).map((row) => row.question));
      return {
        included: includedTopics.length,
        percentage: percent(includedTopics.length, topics),
      };
    });
    const countryPercentages = countryStatistics.map((item) => item.percentage);
    const countries = unique(filtered.map((row) => row.countryName));
    const surveys = unique(filtered.map((row) => row.survey));
    const includedCountryTopicPairs = new Set(
      filtered
        .filter((row) => row.include === 1)
        .map((row) => `${row.countryName}||${row.question}`),
    );
    return {
      topics,
      coverage: percent(includedCountryTopicPairs.size, topics * countries.length),
      countries: countries.length,
      surveys: surveys.length,
      averageIncluded: countries.length ? Math.round(includedCountryTopicPairs.size / countries.length) : 0,
      minimumIncluded: countryStatistics.length ? Math.min(...countryStatistics.map((item) => item.included)) : 0,
      maximumIncluded: countryStatistics.length ? Math.max(...countryStatistics.map((item) => item.included)) : 0,
      medianCountryIncluded: median(countryStatistics.map((item) => item.included)),
      minimumPercentage: countryPercentages.length ? Math.min(...countryPercentages) : 0,
      maximumPercentage: countryPercentages.length ? Math.max(...countryPercentages) : 0,
      medianPercentage: median(countryPercentages),
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
        const regionCountries = unique(regionRows.map((row) => row.countryName));
        const includedCountries = regionCountries.filter((countryName) => regionRows.some((row) => row.countryName === countryName && row.include === 1));
        return percent(includedCountries.length, regionCountries.length);
      });
      const countries = unique(questionRows.map((row) => row.countryName));
      const includedCountries = countries.filter((countryName) => questionRows.some((row) => row.countryName === countryName && row.include === 1));
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
      const countries = unique(questionRows.map((row) => row.countryName));
      const included = countries.filter((countryName) => questionRows.some((row) => row.countryName === countryName && row.include === 1)).length;
      return { question, included, total: countries.length, coverage: percent(included, countries.length) };
    });
  }, [filtered, selectedQuestionnaire]);

  return (
    <section aria-labelledby="overview-title">
      <div className="view-heading">
        <div className="title-with-info">
          <h1 id="overview-title">Overall</h1>
          <InfoButton label="Open guide to Overview calculations" onClick={() => setShowInfo(true)} />
        </div>
        <SelectControl label="Content from" value={round} values={ROUND_ORDER} onChange={setRound} ariaLabel="MICS round" />
      </div>

      {showInfo && <InfoModal id="overview-guide-title" title="How the Overview is calculated" onClose={() => setShowInfo(false)}>
        <p className="methodology-intro">All values use records from the MICS round selected under <strong>Content from</strong>. A topic/module is included when its <strong>Include</strong> value is 1.</p>
        <div className="methodology-grid">
          <section className="methodology-card"><h3>Headline metrics</h3><ul>
            <li><strong>Topics/Modules:</strong> distinct topic/module names in the selected round.</li>
            <li><strong>Total participated countries:</strong> distinct cleaned Country Name values. Multiple surveys from one country count once.</li>
            <li><strong>Total surveys:</strong> distinct Survey values, including national and subnational surveys.</li>
          </ul></section>
          <section className="methodology-card"><h3>Overall percentage</h3>
            <p>Each country-topic pair counts once. If any survey for a country includes a topic/module, that pair is included.</p>
            <div className="formula-box"><strong>Included country-topic pairs</strong><span>÷</span><strong>Topics/modules × countries</strong><span>× 100</span></div>
            <p>The absolute number beneath the percentage is the average included topics/modules per country.</p>
          </section>
          <section className="methodology-card"><h3>Minimum, maximum and median</h3><p>Each country’s percentage is its distinct included topics/modules divided by all topics/modules in the selected round. The cards summarize those country percentages; their notes show absolute topic/module counts.</p></section>
          <section className="methodology-card"><h3>Coverage by topic/module</h3><p>The orange bar shows countries including the topic out of countries with a record for it. Regional rates use the same calculation. Orange, black and blue vertical lines are the regional minimum, median and maximum; equal values intentionally overlap.</p></section>
          <section className="methodology-card methodology-wide"><h3>Questions coverage</h3><p>For the selected questionnaire, each bar divides distinct countries including the question by distinct countries with a record for it. Hover or focus a mark for the numerator, denominator and percentage.</p></section>
        </div>
      </InfoModal>}

      <div className="overview-top-grid">
        <div className="overview-primary-grid">
          <MetricCard label="Topics/Modules" value={metrics.topics} />
          <MetricCard label="Total participated countries" value={metrics.countries} tone="pale" />
          <MetricCard label="Total surveys" value={metrics.surveys} tone="gray" />
          <PhotoPanel />
        </div>

        <section className="summary-statistics" aria-labelledby="percentage-summary-title">
          <h2 id="percentage-summary-title">Percent topics/modules survey included in survey</h2>
          <p>Distribution across participating countries in the selected MICS round.</p>
          <div className="coverage-stat-grid">
            <MetricCard label="Percent topics/modules survey included in survey" value={`${metrics.coverage}%`} tone="navy" note={`${metrics.averageIncluded} of ${metrics.topics} topics/modules included per country`} />
            <MetricCard label="Minimum" value={`${metrics.minimumPercentage}%`} note={`${metrics.minimumIncluded} of ${metrics.topics} topics/modules included`} />
            <MetricCard label="Maximum" value={`${metrics.maximumPercentage}%`} tone="cyan" note={`${metrics.maximumIncluded} of ${metrics.topics} topics/modules included`} />
            <MetricCard label="Median" value={`${metrics.medianPercentage}%`} tone="navy" note={`${metrics.medianCountryIncluded} of ${metrics.topics} topics/modules included`} />
          </div>
        </section>
      </div>

      <section className="dashboard-section">
        <h2>Percent topics/modules survey included in survey by topic/module</h2>
        <p className="section-note">Regional minimum, median and maximum percentages. Hover or focus any mark for its exact value.</p>
        <div className="coverage-head"><span>Total countries</span><span>Percent topics/modules survey included in survey</span></div>
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
  const regionOptions = useMemo(() => [ALL_REGIONS, ...regions], [regions]);
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [survey, setSurvey] = useState("");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("All survey in the same regions");
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

    return contentTitles.slice(0, 5).map((contentTitle) => {
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
    const header = ["Content Title", "Region", "Survey", "Country Name", "MICS Round", "Question", "Include"];
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
          <SelectControl label="Content from" value={round} values={ROUND_ORDER} onChange={setRound} ariaLabel="MICS round" />
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
          <section className="methodology-card methodology-wide"><h3>Topic/module comparison chart</h3><p>For each questionnaire topic/module, coverage is included questions divided by all questions in that topic/module. The <strong>blue line</strong> is the active top-filter selection. Thin dark-gray lines are comparison surveys. Equal values intentionally overlap, and the tooltip lists overlapping surveys.</p></section>
          <section className="methodology-card methodology-wide"><h3>Compare with options</h3>
            <dl className="comparison-definitions">
              <div><dt>All surveys in the same round</dt><dd>One comparison line for every survey in the selected MICS round.</dd></div>
              <div><dt>All survey in the same regions</dt><dd>One line for every survey in the selected region, including other surveys from the selected country.</dd></div>
              <div><dt>Median of the country</dt><dd>One median line across all national and subnational surveys sharing the selected Country Name.</dd></div>
              <div><dt>Median of region</dt><dd>One median line calculated from individual survey percentages in the selected region.</dd></div>
              <div><dt>Median of MICS countries</dt><dd>One median line calculated from all individual survey percentages in the selected round.</dd></div>
            </dl>
          </section>
          <section className="methodology-card methodology-wide"><h3>Availability rules and survey table</h3><p>With <strong>All regions</strong>, comparison is fixed to all surveys in the same round. When both <strong>All countries</strong> and <strong>All surveys</strong> are selected, only that round-wide comparison is offered. The bottom table lists distinct surveys matching the top filters.</p></section>
        </div>
      </InfoModal>}

      <div className="metric-grid country-primary-grid">
        <MetricCard label="Total topics/modules" value={metrics.total} />
        <MetricCard label="Topics/Modules included in survey" value={metrics.included} tone="cyan" />
        <MetricCard label={selectedCountry === ALL_COUNTRIES ? "Surveys in selection" : "Surveys in selected country"} value={metrics.surveyCount} tone="navy" />
        <PhotoPanel country />
      </div>

      <section className="summary-statistics country-summary-statistics" aria-labelledby="country-percentage-summary-title">
        <h2 id="country-percentage-summary-title">Percent topics/modules survey included in survey</h2>
        <p>{selectedCountry === ALL_COUNTRIES ? "Distribution across surveys in the selected region." : "Distribution across surveys and subnational surveys in the selected country."}</p>
        <div className="coverage-stat-grid">
          <MetricCard label={selectedSurvey === ALL_SURVEYS ? "All selected surveys" : "Selected survey"} value={`${metrics.coverage}%`} tone="navy" note={`${metrics.included} of ${metrics.total} topics/modules included`} />
          <MetricCard label="Minimum" value={`${coverageSummary.minimumPercentage}%`} note={`${coverageSummary.minimumIncluded} topics/modules included`} />
          <MetricCard label="Maximum" value={`${coverageSummary.maximumPercentage}%`} tone="cyan" note={`${coverageSummary.maximumIncluded} topics/modules included`} />
          <MetricCard label="Median" value={`${coverageSummary.medianPercentage}%`} tone="navy" note={`${coverageSummary.medianIncluded} topics/modules included`} />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-title-row topic-title-row">
          <h2>Percent topics/modules survey included in survey</h2>
          <SelectControl label="Compare with" value={selectedComparisonMode} values={comparisonOptions} disabled={selectedRegion === ALL_REGIONS} onChange={(value) => setComparisonMode(value as ComparisonMode)} ariaLabel="Topic coverage comparison" />
        </div>
        <p className="section-note">The blue line shows the active survey, country, region or round selection. Dark-gray lines show the selected comparison group.</p>
        <div className="coverage-head country-coverage-head"><span>Topics/Modules</span><span>Percent topics/modules survey included in survey</span></div>
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
