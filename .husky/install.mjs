try {
  const husky = (await import('husky')).default;
  console.log(husky());
} catch (e) {
  process.exit(0);
}
