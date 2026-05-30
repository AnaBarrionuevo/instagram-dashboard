const DEFAULT_AGENDA_URL = "https://felizarcoiris.com/api/agenda/semana";

export interface AgendaCiclo {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  dia_semana: string | null;
  horario: string | null;
  flyer_url: string | null;
  color_tag: string;
  activo: boolean;
  orden: number;
  created_at: string;
}

export interface AgendaEvento {
  id?: string;
  nombre?: string;
  descripcion?: string | null;
  fecha?: string;
  horario?: string | null;
  slug?: string;
}

export interface AgendaSemanaResponse {
  generated_at: string;
  timezone: string;
  today: {
    weekday: string;
    weekday_num: number;
    date: string;
  };
  tonight: AgendaCiclo | null;
  ciclos: AgendaCiclo[];
  eventos: AgendaEvento[];
}

export function getAgendaSemanaUrl(): string {
  return process.env.AGENDA_SEMANA_API_URL ?? DEFAULT_AGENDA_URL;
}

export async function fetchAgendaSemana(
  url?: string
): Promise<AgendaSemanaResponse> {
  const target = url ?? getAgendaSemanaUrl();
  const res = await fetch(target, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Agenda API error (${res.status}) from ${target}`);
  }

  const json = (await res.json()) as AgendaSemanaResponse;

  if (!json.generated_at || !Array.isArray(json.ciclos)) {
    throw new Error("Agenda API returned an unexpected response shape");
  }

  return json;
}

function formatCiclo(ciclo: AgendaCiclo): string {
  const parts = [
    ciclo.dia_semana ?? "Sin día fijo",
    ciclo.nombre,
    ciclo.horario,
    ciclo.descripcion?.trim(),
  ].filter(Boolean);

  return `- ${parts.join(" · ")}`;
}

function formatEvento(evento: AgendaEvento): string {
  const parts = [
    evento.fecha,
    evento.nombre,
    evento.horario,
    evento.descripcion?.trim(),
  ].filter(Boolean);

  return `- ${parts.join(" · ") || JSON.stringify(evento)}`;
}

export function formatAgendaSemanaFile(data: AgendaSemanaResponse): string {
  const lines: string[] = [
    "Agenda semanal — Feliza Arcoíris",
    `Generated: ${data.generated_at}`,
    `Timezone: ${data.timezone}`,
    `Hoy: ${data.today.weekday} (${data.today.date})`,
    "",
    "Use this file for the current weekly schedule, recurring nights, and special events.",
    "",
  ];

  if (data.tonight) {
    lines.push("Esta noche:");
    lines.push(formatCiclo(data.tonight));
    lines.push("");
  }

  const ciclos = [...data.ciclos].sort((a, b) => a.orden - b.orden);

  lines.push("Programación semanal (ciclos recurrentes):");
  if (ciclos.length === 0) {
    lines.push("- No hay ciclos activos.");
  } else {
    for (const ciclo of ciclos) {
      lines.push(formatCiclo(ciclo));
    }
  }
  lines.push("");

  lines.push("Eventos especiales:");
  if (data.eventos.length === 0) {
    lines.push("- No hay eventos especiales publicados esta semana.");
  } else {
    for (const evento of data.eventos) {
      lines.push(formatEvento(evento));
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

export async function buildAgendaSemanaContent(): Promise<{
  content: string;
  cicloCount: number;
  eventoCount: number;
}> {
  const data = await fetchAgendaSemana();

  return {
    content: formatAgendaSemanaFile(data),
    cicloCount: data.ciclos.length,
    eventoCount: data.eventos.length,
  };
}
