const express = require('express');
const cors = require('cors');
require('dotenv').config();

const supabase = require('./supabaseClient');

const app = express();
app.use(cors());
app.use(express.json());

/**
 * 🔧 Helper: Convert "2,4,5" → ["2","4","5"]
 */
const parseSerials = (serial) => {
  return serial
    ? serial.split(',').map(s => s.trim()).filter(Boolean)
    : [];
};


/**
 * ============================
 * 🟢 CREATE ENTRY API
 * ============================
 */
app.post('/add-entry', async (req, res) => {
  console.log("📥 Incoming:", req.body);

  const {
    s_no,
    serial_number,
    token_number,
    ration_card_number,
    no_of_voters,
    no_of_non_voters,
    no_of_total_peoples,
    phone_number,
    admin
  } = req.body;

  try {
    // ✅ 1. Mandatory Fields (ONLY THESE TWO)
    if (!token_number || !phone_number) {
      return res.status(400).json({
        message: "token_number and phone_number are required"
      });
    }

    const inputSerials = serial_number
      ? serial_number.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    // ✅ 2. TOKEN UNIQUE CHECK
    const { data: tokenData } = await supabase
      .from('ration_entries')
      .select('*')
      .eq('token_number', token_number);

    if (tokenData.length > 0) {
      return res.status(400).json({
        message: "This token is already distributed"
      });
    }

    // ✅ 3. RATION UNIQUE CHECK (ONLY IF PROVIDED)
    if (ration_card_number) {
      const { data: rationData } = await supabase
        .from('ration_entries')
        .select('*')
        .eq('ration_card_number', ration_card_number);

      if (rationData.length > 0) {
        return res.status(400).json({
          message: `This ration card is mapped with serial ${rationData[0].serial_number} and token ${rationData[0].token_number}`
        });
      }
    }

    // ✅ 4. SERIAL COUNT VALIDATION (ONLY IF PROVIDED)
    if (serial_number && no_of_voters) {
      if (inputSerials.length !== Number(no_of_voters)) {
        return res.status(400).json({
          message: `Serial count (${inputSerials.length}) must match no_of_voters (${no_of_voters})`
        });
      }
    }

    // ✅ 5. TOTAL PEOPLE VALIDATION (ONLY IF PROVIDED)
    if (
      no_of_total_peoples !== undefined &&
      no_of_voters !== undefined &&
      no_of_non_voters !== undefined
    ) {
      if (
        Number(no_of_total_peoples) !==
        Number(no_of_voters) + Number(no_of_non_voters)
      ) {
        return res.status(400).json({
          message: "Total peoples must be voters + non_voters"
        });
      }
    }

    // ✅ 6. SERIAL DUPLICATE CHECK (ONLY IF PROVIDED)
    if (serial_number) {
      const { data: allData } = await supabase
        .from('ration_entries')
        .select('*');

      for (let row of allData) {
        const dbSerials = row.serial_number
          ? row.serial_number.split(',').map(s => s.trim())
          : [];

        for (let serial of inputSerials) {
          if (dbSerials.includes(serial)) {
            return res.status(400).json({
              message: `This SerialNumber ${serial} is already mapped with ration ${row.ration_card_number} and token ${row.token_number}`
            });
          }
        }
      }
    }

    // ✅ 7. INSERT DATA
    const { data, error } = await supabase
      .from('ration_entries')
      .insert([{
        s_no: s_no || null,
        serial_number: serial_number || null,
        token_number,
        ration_card_number: ration_card_number || null,
        no_of_voters: no_of_voters || null,
        no_of_non_voters: no_of_non_voters || null,
        no_of_total_peoples: no_of_total_peoples || null,
        phone_number,
        admin: admin || null
      }]);

    if (error) throw error;

    res.json({
      message: "Data inserted successfully",
      data
    });

  } catch (err) {
    console.log("🔥 ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ============================
 * 📥 GET ALL
 * ============================
 */
app.get('/entries', async (req, res) => {
  console.log("📤 Fetch all");

  try {
    const { data, error } = await supabase
      .from('ration_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
    console.log(data, "+++++++")

  } catch (err) {
    console.log("🔥 ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ============================
 * ✏️ UPDATE API
 * ============================
 */
app.put('/update-entry/:id', async (req, res) => {
  const { id } = req.params;

  console.log("✏️ Update ID:", id);
  console.log("📥 Incoming:", req.body);

  const {
    s_no,
    serial_number,
    token_number,
    ration_card_number,
    no_of_voters,
    no_of_non_voters,
    no_of_total_peoples,
    phone_number,
    admin
  } = req.body;

  try {
    // ✅ 1. Mandatory Fields (ONLY THESE TWO)
    if (!token_number || !phone_number) {
      return res.status(400).json({
        message: "token_number and phone_number are required"
      });
    }

    const inputSerials = serial_number
      ? serial_number.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    // ✅ 2. TOKEN UNIQUE CHECK (exclude current record)
    const { data: tokenData } = await supabase
      .from('ration_entries')
      .select('*')
      .eq('token_number', token_number)
      .neq('id', id);

    if (tokenData.length > 0) {
      return res.status(400).json({
        message: "This token is already distributed"
      });
    }

    // ✅ 3. RATION UNIQUE CHECK (ONLY IF PROVIDED)
    if (ration_card_number) {
      const { data: rationData } = await supabase
        .from('ration_entries')
        .select('*')
        .eq('ration_card_number', ration_card_number)
        .neq('id', id);

      if (rationData.length > 0) {
        return res.status(400).json({
          message: "Ration card already exists"
        });
      }
    }

    // ✅ 4. SERIAL COUNT VALIDATION (ONLY IF PROVIDED)
    if (serial_number && no_of_voters) {
      if (inputSerials.length !== Number(no_of_voters)) {
        return res.status(400).json({
          message: `Serial count (${inputSerials.length}) must match no_of_voters (${no_of_voters})`
        });
      }
    }

    // ✅ 5. TOTAL PEOPLE VALIDATION (ONLY IF PROVIDED)
    if (
      no_of_total_peoples !== undefined &&
      no_of_voters !== undefined &&
      no_of_non_voters !== undefined
    ) {
      if (
        Number(no_of_total_peoples) !==
        Number(no_of_voters) + Number(no_of_non_voters)
      ) {
        return res.status(400).json({
          message: "Total peoples must be voters + non_voters"
        });
      }
    }

    // ✅ 6. SERIAL DUPLICATE CHECK (ONLY IF PROVIDED)
    if (serial_number) {
      const { data: allData } = await supabase
        .from('ration_entries')
        .select('*');

      for (let row of allData) {
        if (row.id === id) continue;

        const dbSerials = row.serial_number
          ? row.serial_number.split(',').map(s => s.trim())
          : [];

        for (let serial of inputSerials) {
          if (dbSerials.includes(serial)) {
            return res.status(400).json({
              message: `Serial ${serial} already mapped with ration ${row.ration_card_number}`
            });
          }
        }
      }
    }

    // ✅ 7. UPDATE DATA (only update provided fields)
    const updatePayload = {
      updated_at: new Date().toISOString()
    };

    if (s_no !== undefined) updatePayload.s_no = s_no;
    if (serial_number !== undefined) updatePayload.serial_number = serial_number;
    if (token_number !== undefined) updatePayload.token_number = token_number;
    if (ration_card_number !== undefined) updatePayload.ration_card_number = ration_card_number;
    if (no_of_voters !== undefined) updatePayload.no_of_voters = no_of_voters;
    if (no_of_non_voters !== undefined) updatePayload.no_of_non_voters = no_of_non_voters;
    if (no_of_total_peoples !== undefined) updatePayload.no_of_total_peoples = no_of_total_peoples;
    if (phone_number !== undefined) updatePayload.phone_number = phone_number;
    if (admin !== undefined) updatePayload.admin = admin;

    const { data, error } = await supabase
      .from('ration_entries')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;

    res.json({
      message: "Updated successfully",
      data
    });

  } catch (err) {
    console.log("🔥 ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ============================
 * 🗑️ DELETE API
 * ============================
 */
app.delete('/delete-entry/:id', async (req, res) => {
  const { id } = req.params;

  console.log("🗑️ Delete:", id);

  try {
    const { error } = await supabase
      .from('ration_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    console.log("🔥 ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ============================
 * 🚀 SERVER
 * ============================
 */
app.listen(5000, () => {
  console.log("Server running on port 5000");
});