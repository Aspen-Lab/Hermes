import { describe, expect, it } from "vitest";
import { adzunaJobToRawItem } from "./adzuna";
import { himalayasJobToRawItem } from "./himalayas";
import { jsearchJobToRawItem } from "./jsearch";
import { remotiveJobToRawItem } from "./remotive";
import { usaJobsDescriptorToRawItem } from "./usajobs";

const remotiveBase = {
  id: 42,
  title: "Research Engineer",
  url: "https://remotive.com/remote-jobs/research-engineer-42",
  company_name: "Example Labs",
};

const himalayasBase = {
  title: "Materials Scientist",
  applicationLink: "https://himalayas.app/jobs/materials-scientist",
  companyName: "Example Energy",
};

describe("Remotive salary mapping", () => {
  it.each([
    [
      "$31,2k- $52k",
      {
        salaryText: "$31,2k- $52k",
        salaryMin: 31_200,
        salaryMax: 52_000,
        salaryCurrency: "USD",
        salaryPeriod: "year",
      },
    ],
    [
      "$18 - $22/hr",
      {
        salaryText: "$18 - $22/hr",
        salaryMin: 18,
        salaryMax: 22,
        salaryCurrency: "USD",
        salaryPeriod: "hour",
      },
    ],
  ] as const)("parses the measured %s fixture", (salary, expected) => {
    expect(remotiveJobToRawItem({ ...remotiveBase, salary })).toMatchObject(expected);
  });

  it("keeps an empty measured salary from becoming a value", () => {
    expect(remotiveJobToRawItem({ ...remotiveBase, salary: "" })).toMatchObject({
      salaryText: undefined,
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: undefined,
      salaryPeriod: undefined,
    });
  });
});

describe("Himalayas salary mapping", () => {
  it.each([
    [
      { minSalary: 800, maxSalary: 1_500, currency: "USD", salaryPeriod: "monthly" },
      { salaryMin: 800, salaryMax: 1_500, salaryCurrency: "USD", salaryPeriod: "month" },
    ],
    [
      { minSalary: 64_000, maxSalary: 125_000, currency: "EUR", salaryPeriod: "annual" },
      {
        salaryMin: 64_000,
        salaryMax: 125_000,
        salaryCurrency: "EUR",
        salaryPeriod: "year",
      },
    ],
  ] as const)("normalizes measured structured fixture %#", (salary, expected) => {
    expect(himalayasJobToRawItem({ ...himalayasBase, ...salary })).toMatchObject(expected);
  });

  it("rejects the measured garbage monthly range", () => {
    expect(
      himalayasJobToRawItem({
        ...himalayasBase,
        minSalary: 50,
        maxSalary: 1_000,
        currency: "USD",
        salaryPeriod: "monthly",
      }),
    ).toMatchObject({
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: undefined,
      salaryPeriod: undefined,
    });
  });
});

describe("Adzuna salary mapping", () => {
  const base = {
    id: "adzuna-1",
    title: "Battery Scientist",
    redirect_url: "https://www.adzuna.com/details/adzuna-1",
  };

  it("maps an annual estimate and labels it as estimated", () => {
    expect(
      adzunaJobToRawItem(
        { ...base, salary_min: 90_000, salary_max: 120_000, salary_is_predicted: "1" },
        "us",
      ),
    ).toMatchObject({
      salaryMin: 90_000,
      salaryMax: 120_000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      salaryIsEstimated: true,
    });
  });

  it("leaves salary fields empty when salary is absent", () => {
    expect(adzunaJobToRawItem(base, "us")).toMatchObject({
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: undefined,
      salaryPeriod: undefined,
      salaryIsEstimated: undefined,
    });
  });
});

describe("JSearch salary mapping", () => {
  const base = {
    job_id: "jsearch-1",
    job_title: "Research Engineer",
    job_apply_link: "https://example.com/jsearch-1",
  };

  it("maps an hourly salary in its stated currency", () => {
    expect(
      jsearchJobToRawItem({
        ...base,
        job_min_salary: 45,
        job_max_salary: 65,
        job_salary_currency: "USD",
        job_salary_period: "HOUR",
      }),
    ).toMatchObject({
      salaryMin: 45,
      salaryMax: 65,
      salaryCurrency: "USD",
      salaryPeriod: "hour",
    });
  });

  it("leaves salary fields empty when salary is absent", () => {
    expect(jsearchJobToRawItem(base)).toMatchObject({
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: undefined,
      salaryPeriod: undefined,
    });
  });
});

describe("USAJobs salary mapping", () => {
  const base = {
    PositionID: "usajobs-1",
    PositionTitle: "Physical Scientist",
    PositionURI: "https://www.usajobs.gov/job/usajobs-1",
  };

  it("maps a documented per-annum remuneration range", () => {
    expect(
      usaJobsDescriptorToRawItem({
        ...base,
        PositionRemuneration: [
          { MinimumRange: "98,496", MaximumRange: "151,308", RateIntervalCode: "PA" },
        ],
      }),
    ).toMatchObject({
      salaryMin: 98_496,
      salaryMax: 151_308,
      salaryCurrency: "USD",
      salaryPeriod: "year",
    });
  });

  it("suppresses salary for an unrecognized interval code", () => {
    expect(
      usaJobsDescriptorToRawItem({
        ...base,
        PositionRemuneration: [
          { MinimumRange: "98,496", MaximumRange: "151,308", RateIntervalCode: "PX" },
        ],
      }),
    ).toMatchObject({
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: undefined,
      salaryPeriod: undefined,
    });
  });
});
