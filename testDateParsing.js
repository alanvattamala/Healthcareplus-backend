// Test script to verify date parsing works correctly

const parseLocalDate = (dateString) => {
  // Expect format: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }
  
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date in UTC to avoid timezone issues when storing in database
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return date;
};

console.log('Testing date parsing for September 30, 2025:');
console.log('Input: "2025-09-30"');

const parsedDate = parseLocalDate("2025-09-30");
console.log('Parsed date:', parsedDate);
console.log('ISO String:', parsedDate.toISOString());
console.log('UTC Date:', parsedDate.getUTCDate());
console.log('UTC Month:', parsedDate.getUTCMonth() + 1); // +1 because months are 0-indexed
console.log('UTC Year:', parsedDate.getUTCFullYear());

console.log('\nThis should show September 30, 2025 in the database as:', parsedDate.toISOString());