import { execSync } from 'child_process';
import fs from 'fs';

const original = execSync('git show HEAD:src/pages/admin/EirJourneyAdmin.tsx').toString();
fs.writeFileSync('src/pages/admin/EirJourneyAdmin.tsx', original);
console.log("Reverted");
