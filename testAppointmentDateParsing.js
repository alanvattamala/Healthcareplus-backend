// Test script to verify date parsing consistency
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

// Test with October 10, 2025
const testDate = "2025-10-10";
const parsedDate = parseLocalDate(testDate);

console.log('Input date string:', testDate);
console.log('Parsed date:', parsedDate);
console.log('Parsed date ISO string:', parsedDate.toISOString());
console.log('Parsed date UTC date only:', parsedDate.toISOString().split('T')[0]);

// Test today comparison
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

console.log('\nToday comparison:');
console.log('Today local:', today);
console.log('Today UTC:', todayUTC);
console.log('Today UTC ISO:', todayUTC.toISOString().split('T')[0]);

console.log('\nComparison results:');
console.log('Is same day?:', parsedDate.getTime() === todayUTC.getTime());
console.log('Parsed timestamp:', parsedDate.getTime());
console.log('Today UTC timestamp:', todayUTC.getTime());