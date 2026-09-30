import { quarantineIncompleteArtifacts } from './lib/source-evidence.mjs';

try {
  const quarantined = await quarantineIncompleteArtifacts();
  console.log(`Preserved ${quarantined.length} incomplete historical receipts in quarantine; no past parser evidence was invented.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
