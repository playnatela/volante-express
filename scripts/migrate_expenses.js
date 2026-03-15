import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateExpenses() {
    console.log("Fetching expenses with region 'divinopolis' or null...");

    // Buscar todas as despesas que estão com region_id = 'divinopolis' ou null
    const { data: expenses, error: fetchError } = await supabase
        .from('expenses')
        .select('id, description, region_id')
        .or('region_id.eq.divinopolis,region_id.is.null');

    if (fetchError) {
        console.error("Error fetching expenses:", fetchError);
        return;
    }

    if (!expenses || expenses.length === 0) {
        console.log("No expenses found requiring migration.");
        return;
    }

    console.log(`Found ${expenses.length} expenses to migrate. Updating to 'setelagoas'...`);

    // Atualizar para setelagoas
    for (const exp of expenses) {
        const { error: updateError } = await supabase
            .from('expenses')
            .update({ region_id: 'setelagoas' })
            .eq('id', exp.id);

        if (updateError) {
            console.error(`Failed to update expense ${exp.id} (${exp.description}):`, updateError);
        } else {
            console.log(`✅ Updated: ${exp.description}`);
        }
    }

    console.log("Migration complete!");
}

migrateExpenses();
