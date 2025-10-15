// Test script to debug appointment booking date issues
console.log('=== Date Parsing Test ===');

const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

// Test with current dates
const today = new Date();
const todayString = today.toISOString().split('T')[0];
const oct10String = "2025-10-10";
const oct9String = "2025-10-09";

console.log('Today (local):', today.toISOString());
console.log('Today string:', todayString);

console.log('\n=== Testing parseLocalDate ===');
const todayParsed = parseLocalDate(todayString);
const oct9Parsed = parseLocalDate(oct9String);
const oct10Parsed = parseLocalDate(oct10String);

console.log('Today parsed:', todayParsed.toISOString());
console.log('Oct 9 parsed:', oct9Parsed.toISOString());
console.log('Oct 10 parsed:', oct10Parsed.toISOString());

console.log('\n=== Date Comparisons ===');
console.log('Is Oct 9 today?', oct9Parsed.getTime() === todayParsed.getTime());
console.log('Is Oct 10 today?', oct10Parsed.getTime() === todayParsed.getTime());
console.log('Is Oct 10 future?', oct10Parsed.getTime() > todayParsed.getTime());

console.log('\n=== Expected Behavior ===');
console.log('For Oct 10 (future date):');
console.log('- Should allow booking regardless of doctor active status');
console.log('- Should NOT trigger same-day restrictions');

console.log('\nFor Oct 9 (today):');
console.log('- Should check doctor active status');
console.log('- Should block if doctor is offline');