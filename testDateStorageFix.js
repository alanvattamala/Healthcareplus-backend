// Test script to verify date storage fix
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  // Set to noon UTC to avoid timezone boundary issues
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
};

console.log('=== Date Storage Fix Test ===');

// Test with October 11, 2025 (the problematic date)
const testDates = ['2025-10-11', '2025-10-10', '2025-10-09'];

testDates.forEach(dateString => {
  console.log(`\n--- Testing: ${dateString} ---`);
  
  const parsedDate = parseLocalDate(dateString);
  
  console.log('Input date string:', dateString);
  console.log('Parsed date (ISO):', parsedDate.toISOString());
  console.log('Parsed date (UTC):', parsedDate.toUTCString());
  console.log('Date only (ISO):', parsedDate.toISOString().split('T')[0]);
  
  // Simulate what would happen in different timezones
  console.log('Local string representation:', parsedDate.toString());
  
  // Check if the date portion matches what we expect
  const expectedDate = dateString;
  const actualDate = parsedDate.toISOString().split('T')[0];
  const isCorrect = expectedDate === actualDate;
  
  console.log(`Expected: ${expectedDate}, Got: ${actualDate}, Correct: ${isCorrect ? '✅' : '❌'}`);
});

console.log('\n=== Expected Behavior ===');
console.log('✅ Input "2025-10-11" should store as 2025-10-11T12:00:00.000Z');
console.log('✅ Date portion should remain 2025-10-11 regardless of timezone');
console.log('✅ No shifting to previous/next day due to timezone boundaries');

console.log('\n=== Comparison with Old Method ===');
const oldParseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)); // Midnight UTC
};

const newParse = parseLocalDate('2025-10-11');
const oldParse = oldParseLocalDate('2025-10-11');

console.log('New method (noon UTC):', newParse.toISOString());
console.log('Old method (midnight UTC):', oldParse.toISOString());
console.log('Difference in hours:', (newParse.getTime() - oldParse.getTime()) / (1000 * 60 * 60));