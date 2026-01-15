/**
 * Parse todos from note text
 * Supports formats like:
 * - @member_name: todo text [priority] [date]
 * - @member_name: todo text [high] [2024-01-20]
 * - TODO: @member_name todo text [urgent] [2024-01-20]
 */

export interface ParsedTodo {
  memberName: string;
  memberId?: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  description?: string;
  rawMatch: string;
  startIndex: number;
  endIndex: number;
}

export function parseTodosFromText(
  text: string,
  members: Array<{ _id: string; name: string }>
): ParsedTodo[] {
  const todos: ParsedTodo[] = [];
  
  // Pattern 1: @member_name: todo text [priority] [date]
  const pattern1 = /@(\w+(?:\s+\w+)*):\s*([^@\n]+?)(?:\s*\[(low|medium|high|urgent)\])?(?:\s*\[(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\])?/gi;
  
  // Pattern 2: TODO: @member_name todo text [priority] [date]
  const pattern2 = /TODO:\s*@(\w+(?:\s+\w+)*)\s+([^@\n]+?)(?:\s*\[(low|medium|high|urgent)\])?(?:\s*\[(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\])?/gi;
  
  // Pattern 3: - @member_name: todo text [priority] [date]
  const pattern3 = /[-*]\s*@(\w+(?:\s+\w+)*):\s*([^@\n]+?)(?:\s*\[(low|medium|high|urgent)\])?(?:\s*\[(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\])?/gi;
  
  const patterns = [pattern1, pattern2, pattern3];
  
  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const memberName = match[1].trim();
      const todoText = match[2].trim();
      const priority = (match[3]?.toLowerCase() || 'medium') as ParsedTodo['priority'];
      const dateStr = match[4];
      
      // Find member by name (fuzzy match)
      const member = members.find(
        (m) =>
          m.name.toLowerCase() === memberName.toLowerCase() ||
          m.name.toLowerCase().includes(memberName.toLowerCase()) ||
          memberName.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
      );
      
      if (member && todoText) {
        // Parse date
        let dueDate: Date | undefined;
        if (dateStr) {
          if (dateStr.includes('-')) {
            // YYYY-MM-DD format
            dueDate = new Date(dateStr);
          } else if (dateStr.includes('/')) {
            // MM/DD/YYYY format
            const [month, day, year] = dateStr.split('/');
            dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
          
          // Validate date
          if (dueDate && isNaN(dueDate.getTime())) {
            dueDate = undefined;
          }
        }
        
        todos.push({
          memberName: member.name,
          memberId: member._id,
          title: todoText,
          priority,
          dueDate,
          rawMatch: match[0],
          startIndex: match.index || 0,
          endIndex: (match.index || 0) + match[0].length,
        });
      }
    }
  });
  
  // Remove duplicates (same member + same title)
  const uniqueTodos = todos.filter(
    (todo, index, self) =>
      index ===
      self.findIndex(
        (t) => t.memberId === todo.memberId && t.title.toLowerCase() === todo.title.toLowerCase()
      )
  );
  
  return uniqueTodos;
}

export function extractMemberMentions(text: string, members: Array<{ _id: string; name: string }>): Array<{ memberId: string; memberName: string }> {
  const mentions: Array<{ memberId: string; memberName: string }> = [];
  const mentionPattern = /@(\w+(?:\s+\w+)*)/gi;
  
  let match;
  while ((match = mentionPattern.exec(text)) !== null) {
    const memberName = match[1].trim();
    const member = members.find(
      (m) =>
        m.name.toLowerCase() === memberName.toLowerCase() ||
        m.name.toLowerCase().includes(memberName.toLowerCase()) ||
        memberName.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
    );
    
    if (member && !mentions.find((m) => m.memberId === member._id)) {
      mentions.push({
        memberId: member._id,
        memberName: member.name,
      });
    }
  }
  
  return mentions;
}
