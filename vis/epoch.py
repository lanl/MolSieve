import sys

class Epoch:
    def __init__(self):
        self.counts = {}
        self.winner = ""
        self.max_count = -sys.maxsize - 1
        self.start = sys.maxsize
        self.end = -sys.maxsize - 1
        self.l_child = None
        self.r_child = None
        self.depth = 0

def calculate_epoch(data, depth):

    if len(data) > 10:
        l_data = data[len(data)//2:]
        r_data = data[:len(data)//2]
        l_e = calculate_epoch(l_data, depth + 1)
        r_e = calculate_epoch(r_data, depth + 1)
        n_e = Epoch()

        n_e.l_child = l_e
        n_e.r_child = r_e
        n_e.start = l_e.start if l_e.start < r_e.start else r_e.start
        n_e.end = r_e.end if r_e.end > l_e.end else l_e.end
        
        for c in l_e.counts.items():
            n_e.counts[c[0]] = c[1]

        for c in r_e.counts.items():
            if str(c[0]) not in n_e.counts:
                n_e.counts[c[0]] = c[1]
            else:
                n_e.counts[c[0]] += c[1]

            if n_e.counts[c[0]] > n_e.max_count:
                n_e.winner = c[0]
                n_e.max_count = c[1]
        n_e.depth = depth
        return n_e
    else:
        e = Epoch()
        for d in data:
            # timestep info
            if d['r.timestep'] < e.start:
                e.start = d['r.timestep']
            if d['r.timestep'] > e.end:
                e.end = d['r.timestep']

            if d['n.number'] in e.counts:
                e.counts[d['n.number']] = e.counts[d['n.number']] + 1
                if e.counts[d['n.number']] > e.max_count:
                    e.winner = d['n.number']
                    e.max_count = e.counts[d['n.number']]
            else:
                e.counts[d['n.number']] = 1
        e.depth = depth
        return e
