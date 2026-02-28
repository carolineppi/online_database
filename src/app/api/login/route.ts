// import { createClient } from '@supabase/supabase-js';
// import { NextResponse } from 'next/server';

// // Use the Secret Key here to query the password_hash column safely
// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SECRET_KEY!
// );

// export async function POST(request: Request) {
//   const { email, password } = await request.json();

//   // 1. Find the employee by email
//   const { data: employee, error } = await supabase
//     .from('employees')
//     .select('id, first_name, last_name, password_hash')
//     .eq('email', email)
//     .single();

//   if (error || !employee) {
//     return NextResponse.json({ error: 'Employee not found' }, { status: 401 });
//   }

//   // 2. Compare passwords (In production, use bcrypt.compare)
//   if (employee.password_hash !== password) {
//     return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
//   }

//   // 3. Login successful
//   // Return employee data to be stored in a cookie/session
//   return NextResponse.json({ 
//     success: true, 
//     user: { id: employee.id, name: `${employee.first_name} ${employee.last_name}` } 
//   });
// }