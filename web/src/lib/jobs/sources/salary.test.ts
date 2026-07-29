import { describe, expect, it } from "vitest";
import { himalayasJobToRawItem } from "./himalayas";
import { remotiveJobToRawItem } from "./remotive";

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
