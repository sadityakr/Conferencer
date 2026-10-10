/** The toy conference used for samples and tests. Times are Europe/Berlin local time. */
export const TOY = {
  name: "Toy Conference on Quantum & Soft Matter 2026",
  timezone: "Europe/Berlin",
  days: [
    {
      date: "Monday, 12 October 2026",
      items: [
        { time: "08:30–09:00", kind: "break", title: "Registration & coffee" },
        {
          time: "09:00–10:00", kind: "session", room: "Main Hall", title: "Plenary Session: Opening Keynote", chair: "M. Curie",
          talks: [{ time: "09:00–10:00", title: "Why every photo needs a timestamp", speakers: "Ada Lovelace (Analytical Engines Ltd.)" }],
        },
        { time: "10:00–10:30", kind: "break", title: "Coffee break" },
        {
          time: "10:30–12:00", kind: "session", room: "Room A", title: "Session A1: Quantum Materials", chair: "N. Bohr",
          talks: [
            { time: "10:30–11:00", title: "Topological magnons in thin films", speakers: "K. Leutner, A. Kumar" },
            { time: "11:00–11:30", title: "Moiré excitons at room temperature", speakers: "L. Meitner" },
            { time: "11:30–12:00", title: "Spin qubits in silicon: a reality check", speakers: "R. Feynman, J. Wheeler" },
          ],
        },
        {
          time: "10:30–12:00", kind: "session", room: "Room B", title: "Session B1: Soft Matter & Polymers", chair: "P.-G. de Gennes",
          talks: [
            { time: "10:30–11:00", title: "Self-assembly of block copolymers", speakers: "D. Hodgkin" },
            { time: "11:00–11:30", title: "Active nematics in confinement", speakers: "S. Edwards" },
            { time: "11:30–12:00", title: "Hydrogels that remember", speakers: "R. Franklin" },
          ],
        },
        { time: "12:00–13:00", kind: "break", title: "Lunch" },
        {
          time: "13:00–14:30", kind: "session", room: "Room A", title: "Session A2: Machine Learning for Materials", chair: "A. Turing",
          talks: [
            { time: "13:00–13:30", title: "Foundation models for crystal structures", speakers: "G. Hopper" },
            { time: "13:30–14:00", title: "Vision-language models read your lab notebook", speakers: "C. Shannon" },
            { time: "14:00–14:30", title: "Lit-RAG: retrieval over conference books", speakers: "J. von Neumann" },
          ],
        },
        {
          time: "13:00–14:30", kind: "session", room: "Room B", title: "Session B2: Biophysics", chair: "E. Schrödinger",
          talks: [
            { time: "13:00–13:45", title: "Protein folding under force", speakers: "F. Crick" },
            { time: "13:45–14:30", title: "Membranes as two-dimensional fluids", speakers: "W. Helfrich" },
          ],
        },
        {
          time: "13:00–14:30", kind: "session", room: "Room C", title: "Session C1: Instrumentation", chair: "E. Abbe",
          talks: [
            { time: "13:00–13:45", title: "Cryo-EM on a budget", speakers: "J. Dubochet" },
            { time: "13:45–14:30", title: "Open-hardware AFM", speakers: "G. Binnig" },
          ],
        },
      ],
    },
    {
      date: "Tuesday, 13 October 2026",
      items: [
        {
          time: "09:00–10:30", kind: "session", room: "Room A", title: "Session A3: Superconductivity", chair: "H. Kamerlingh Onnes",
          talks: [
            { time: "09:00–09:45", title: "Nickelates: the next cuprates?", speakers: "J. Bardeen" },
            { time: "09:45–10:30", title: "Hydrides under pressure", speakers: "V. Ginzburg" },
          ],
        },
        {
          time: "09:00–10:30", kind: "session", room: "Room B", title: "Session B3: Glasses & Jamming", chair: "G. Parisi",
          talks: [
            { time: "09:00–09:45", title: "The glass transition in 30 minutes", speakers: "P. Anderson" },
            { time: "09:45–10:30", title: "Jamming of frictional grains", speakers: "S. Nagel" },
          ],
        },
        { time: "10:30–11:00", kind: "break", title: "Coffee break" },
        {
          time: "11:00–12:00", kind: "session", room: "Main Hall", title: "Plenary Session: Closing Keynote", chair: "M. Curie",
          talks: [{ time: "11:00–12:00", title: "From pictures to knowledge", speakers: "Grace Hopper" }],
        },
      ],
    },
  ],
} as const;
