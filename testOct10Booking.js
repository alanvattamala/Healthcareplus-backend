// Test script to verify appointment booking issue
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

// Test with October 10, 2025 (the problematic date)
console.log('=== Testing October 10, 2025 Booking Issue ===');

const testDate = "2025-10-10";
const parsedTestDate = parseLocalDate(testDate);
const today = new Date();
const todayUTC = parseLocalDate(today.toISOString().split('T')[0]);

console.log('Input date string:', testDate);
console.log('Parsed appointment date:', parsedTestDate.toISOString());
console.log('Today UTC:', todayUTC.toISOString());
console.log('Today local:', today.toISOString());

const isAppointmentToday = parsedTestDate.getTime() === todayUTC.getTime();
const isAppointmentFuture = parsedTestDate.getTime() > todayUTC.getTime();

console.log('\n=== Date Comparison Results ===');
console.log('Is appointment today?', isAppointmentToday);
console.log('Is appointment future?', isAppointmentFuture);
console.log('Appointment timestamp:', parsedTestDate.getTime());
console.log('Today timestamp:', todayUTC.getTime());
console.log('Difference in days:', (parsedTestDate.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));

console.log('\n=== Expected Behavior ===');
if (isAppointmentFuture) {
  console.log('✅ This is a future date - should allow booking regardless of doctor online status');
} else if (isAppointmentToday) {
  console.log('⚠️ This is today - should check doctor online status');
} else {
  console.log('❌ This is a past date - should not allow booking');
}

console.log('\n=== MongoDB Query Test ===');
console.log('Query that should be used:');
console.log({
  doctorId: 'DOCTOR_ID_HERE',
  date: parsedTestDate,
  isActive: true
});

console.log('\nDate in MongoDB format:', parsedTestDate.toISOString());