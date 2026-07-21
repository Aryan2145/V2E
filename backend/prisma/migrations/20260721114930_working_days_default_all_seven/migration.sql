-- AlterTable
ALTER TABLE "department_working_days" ALTER COLUMN "working_days" SET DEFAULT '[0,1,2,3,4,5,6]';

-- AlterTable
ALTER TABLE "individual_working_days" ALTER COLUMN "working_days" SET DEFAULT '[0,1,2,3,4,5,6]';

-- AlterTable
ALTER TABLE "org_working_days" ALTER COLUMN "working_days" SET DEFAULT '[0,1,2,3,4,5,6]';
