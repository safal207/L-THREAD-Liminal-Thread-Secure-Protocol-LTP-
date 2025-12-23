import { main } from '../../scripts/verify/ltpVerify';

main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
