/* Pre-2024 talks (and a handful from 2024 that never got an MDX page in
 * this repo). The dynamic talks table on /talks/ merges these with the
 * docs content collection. Keep one entry per row; older talks are
 * month-precision (no specific day was recorded), so date strings use
 * an arbitrary "01" day for sorting purposes — the table only renders
 * the YYYY-MM-DD prefix anyway.
 *
 * URLs were scraped from https://samforeman.me/talks/ on 2026-06-07.
 */

export type LegacyTalk = {
    /** ISO YYYY-MM-DD. Day is "01" when only month was recorded. */
    date: string
    title: string
    /** External deck URL (samforeman.me hosts most of these). */
    url: string
    /** Venue / event name. */
    location?: string
    /** Venue / event URL, when there is a canonical one. */
    locationUrl?: string
}

export const legacyTalks: LegacyTalk[] = [
    // ── 2024 (external decks not in the docs collection) ─────────────
    {
        date: '2024-03-01',
        title: 'Parallel Training Techniques',
        url: 'https://saforem2.github.io/parallel-training-slides',
        location: 'AI-4-Science Training Series',
        locationUrl:
            'https://github.com/argonne-lcf/ai-science-training-series/tree/main/06_parallel_training',
    },
    {
        date: '2024-02-01',
        title: 'LLMs from Scratch',
        url: 'https://saforem2.github.io/llm-workshop-talk',
        location: 'LLM Tutorial Workshop',
        locationUrl: 'https://github.com/argonne-lcf/llm-workshop',
    },
    // ── 2023 ─────────────────────────────────────────────────────────
    {
        date: '2023-11-01',
        title: 'Creating Small(-ish) LLMs',
        url: 'https://saforem2.github.io/LLM-tutorial',
        location: 'LLM Tutorial Workshop',
        locationUrl: 'https://github.com/brettin/llm_tutorial',
    },
    {
        date: '2023-10-15',
        title: 'Exascale Science on Aurora',
        url: 'https://saforem2.github.io/oneapi-talk',
        location: 'Intel oneAPI Workshop @ UIC',
        locationUrl: 'https://www.alcf.anl.gov/events/alcf-hands-hpc-workshop',
    },
    {
        date: '2023-10-01',
        title: 'LLM Lunch Talk',
        url: 'https://saforem2.github.io/llm-lunch-talk',
        location: 'ALCF Hands On HPC Workshop',
    },
    {
        date: '2023-08-01',
        title: 'Scaling LLMs for Science',
        url: 'https://saforem2.github.io/scaling4science',
        location: 'Data-Intensive Computing + AI/ML at Scale',
        locationUrl: 'https://events.cels.anl.gov/event/426/overview',
    },
    {
        date: '2023-07-31',
        title: 'MLMC: Machine Learning Monte Carlo',
        url: 'https://saforem2.github.io/lattice23',
        location: 'Lattice 2023 (Fermilab)',
        locationUrl:
            'https://indico.fnal.gov/event/57249/contributions/271305/',
    },
    {
        date: '2023-07-15',
        title: 'Generative Modeling and Efficient Sampling',
        url: 'https://saforem2.github.io/lqcd-pasc23/',
        location: 'PASC23',
        locationUrl: 'https://pasc23.pasc-conference.org/',
    },
    {
        date: '2023-04-01',
        title: 'Efficient Sampling for LGT',
        url: 'https://saforem2.github.io/deep-fridays',
        location: 'Deep Fridays @ U. Bologna',
        locationUrl: 'https://www.cs.unibo.it/~asperti/deep_fridays.html',
    },
    // ── 2022 ─────────────────────────────────────────────────────────
    {
        date: '2022-11-01',
        title: 'Large Scale Training',
        url: 'https://saforem2.github.io/ai4sci-large-scale-training',
        location: 'AI4Science on Supercomputers, ALCF',
        locationUrl:
            'https://github.com/argonne-lcf/ai-science-training-series',
    },
    {
        date: '2022-10-01',
        title: 'Hyperparameter Management',
        url: 'https://saforem2.github.io/hparam-management-sdl2022/',
        location: 'ALCF SDL Workshop',
        locationUrl:
            'https://www.alcf.anl.gov/events/2022-alcf-simulation-data-and-learning-workshop',
    },
    {
        date: '2022-08-01',
        title: 'Statistical Learning',
        url: 'https://saforem2.github.io/ATPESC-StatisticalLearning',
        location: 'ATPESC 2022',
        locationUrl: 'https://extremecomputingtraining.anl.gov/',
    },
    {
        date: '2022-05-01',
        title: 'Scientific Data Science: An Emerging Symbiosis',
        url: 'https://saforem2.github.io/anl-job-talk/',
        location: 'ANL',
    },
    {
        date: '2022-03-01',
        title: 'Machine Learning in HEP',
        url: 'https://saforem2.github.io/physicsSeminar',
        location: 'UNC Greensboro',
    },
    // ── 2021 ─────────────────────────────────────────────────────────
    {
        date: '2021-12-01',
        title: 'Accelerated Sampling Methods for LGT',
        url: 'https://saforem2.github.io/l2hmc-dwq25/',
        location: 'DWQ @ 25, BNL',
        locationUrl: 'https://indico.bnl.gov/event/13576/',
    },
    {
        date: '2021-09-01',
        title: 'Training Topological Samplers for LGT',
        url: 'https://saforem2.github.io/l2hmc_talk_ect2021',
        location: 'ML4HEP, ECT* Trento',
        locationUrl: 'https://indico.ectstar.eu/event/77/contributions/2349/',
    },
    {
        date: '2021-06-01',
        title: 'l2hmc-qcd',
        url: 'https://github.com/saforem2/l2hmc-qcd',
        location: 'MIT Lattice Group Seminar',
    },
    {
        date: '2021-03-01',
        title: 'Deep Learning HMC for Improved Gauge Generation',
        url: 'https://bit.ly/mainz21',
        location: 'ML in LQCD Workshop',
        locationUrl: 'https://bit.ly/mainz21_overview',
    },
    // ── 2020 ─────────────────────────────────────────────────────────
    {
        date: '2020-06-01',
        title: 'Machine Learning for Lattice QCD',
        url: 'https://slides.com/samforeman/l2hmc-qcd',
        location: 'U. Iowa',
    },
]
